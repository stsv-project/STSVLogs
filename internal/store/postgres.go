package store

import (
	"STSVLogs/internal/model"
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool              *pgxpool.Pool
	cardStatsMu       sync.Mutex
	cardStatsCache    CardStatsOverview
	cardStatsCachedAt time.Time
}

type CardPickRate struct {
	CardID       string  `json:"card_id"`
	CardName     string  `json:"card_name"`
	OfferedCount int     `json:"offered_count"`
	PickedCount  int     `json:"picked_count"`
	SkippedCount int     `json:"skipped_count"`
	PickRate     float64 `json:"pick_rate"`
}

type CardWinRate struct {
	CardID    string  `json:"card_id"`
	CardName  string  `json:"card_name"`
	RunCount  int     `json:"run_count"`
	WinCount  int     `json:"win_count"`
	LossCount int     `json:"loss_count"`
	WinRate   float64 `json:"win_rate"`
}

func New(ctx context.Context, connStr string) (*Store, error) {
	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		return nil, fmt.Errorf("connect to postgres: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	return &Store{pool: pool}, nil
}

func (s *Store) InsertEvent(ctx context.Context, evt model.TelemetryEvent) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO events
			(applicant_id, event_name, request_id, category, timestamp_utc, properties, payload)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (
			(properties->>'anonymous_install_id'),
			(properties->>'session_id'),
			timestamp_utc,
			event_name
		) DO NOTHING
	`, evt.ApplicantID, evt.EventName, evt.RequestID, evt.Category, evt.TimestampUtc, evt.Properties, evt.Payload)
	return err
}

// StatsOverview returns aggregate stats: total events, categories, unique installs, version/platform/language/OS distribution
func (s *Store) StatsOverview(ctx context.Context) (map[string]interface{}, error) {
	result := make(map[string]interface{})

	var total int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM events`).Scan(&total); err != nil {
		return nil, err
	}
	result["total_events"] = total

	categories, err := s.groupCount(ctx,
		`SELECT category, COUNT(*) FROM events GROUP BY category ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	result["categories"] = categories

	var installs int
	if err := s.pool.QueryRow(ctx,
		`SELECT COUNT(DISTINCT properties->>'anonymous_install_id') FROM events`,
	).Scan(&installs); err != nil {
		return nil, err
	}
	result["unique_installs"] = installs

	versions, err := s.groupCount(ctx,
		`SELECT properties->>'game_version', COUNT(*) FROM events GROUP BY properties->>'game_version' ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	result["game_versions"] = versions

	platforms, err := s.groupCount(ctx,
		`SELECT properties->>'platform', COUNT(*) FROM events GROUP BY properties->>'platform' ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	result["platforms"] = platforms

	languages, err := s.groupCount(ctx,
		`SELECT properties->>'game_language', COUNT(*) FROM events GROUP BY properties->>'game_language' ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	result["languages"] = languages

	oses, err := s.groupCount(ctx,
		`SELECT properties->>'os_name', COUNT(*) FROM events GROUP BY properties->>'os_name' ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	result["os_names"] = oses
	// STSVWB 模组版本分布（从 ModInventory payload 中提取）
	stsvwbVersions, err := s.groupCount(ctx,
		`SELECT mod->>'version', COUNT(DISTINCT properties->>'anonymous_install_id')
		FROM events, jsonb_array_elements(payload->'base_payload'->'mods') AS mod
		WHERE category = 'ModInventory' AND mod->>'id' = 'STSVWB'
		GROUP BY mod->>'version'
		ORDER BY COUNT(DISTINCT properties->>'anonymous_install_id') DESC`)
	if err != nil {
		return nil, err
	}
	result["stsvwb_versions"] = stsvwbVersions

	ritsulibVersions, err := s.groupCount(ctx,
		`SELECT properties->>'ritsulib_version', COUNT(*) FROM events GROUP BY properties->>'ritsulib_version' ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	result["ritsulib_versions"] = ritsulibVersions

	arches, err := s.groupCount(ctx,
		`SELECT properties->>'process_architecture', COUNT(*) FROM events GROUP BY properties->>'process_architecture' ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	result["process_architectures"] = arches

	dotnetRuntimes, err := s.groupCount(ctx,
		`SELECT properties->>'dotnet_runtime', COUNT(*) FROM events GROUP BY properties->>'dotnet_runtime' ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	result["dotnet_runtimes"] = dotnetRuntimes

	return result, nil
}

func (s *Store) groupCount(ctx context.Context, query string) (map[string]int, error) {
	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	m := make(map[string]int)
	for rows.Next() {
		var key *string
		var cnt int
		if err := rows.Scan(&key, &cnt); err != nil {
			return nil, err
		}
		keyStr := "(unknown)"
		if key != nil {
			keyStr = *key
		}
		m[keyStr] = cnt
	}
	return m, nil
}

// DailyTrend returns daily event counts for the last N days
func (s *Store) DailyTrend(ctx context.Context, days int) ([]map[string]interface{}, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT DATE(timestamp_utc) AS date, COUNT(*) AS cnt
		FROM events
		WHERE timestamp_utc >= $1
		GROUP BY DATE(timestamp_utc)
		ORDER BY date ASC
	`, time.Now().UTC().AddDate(0, 0, -days))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trend []map[string]interface{}
	for rows.Next() {
		var date time.Time
		var cnt int
		if err := rows.Scan(&date, &cnt); err != nil {
			return nil, err
		}
		trend = append(trend, map[string]interface{}{
			"date":  date.Format("2006-01-02"),
			"count": cnt,
		})
	}
	return trend, nil
}

// DiagnosticsOverview returns exception type ranking, capture source distribution, and per-version exception counts
func (s *Store) DiagnosticsOverview(ctx context.Context) (map[string]interface{}, error) {
	result := make(map[string]interface{})

	var total int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM events WHERE category = 'Diagnostics'`).Scan(&total); err != nil {
		return nil, err
	}
	result["total_diagnostics"] = total

	exceptionTypes, err := s.groupCount(ctx,
		`SELECT properties->>'exception_type', COUNT(*) FROM events WHERE category = 'Diagnostics' GROUP BY properties->>'exception_type' ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	result["exception_types"] = exceptionTypes

	captureSources, err := s.groupCount(ctx,
		`SELECT properties->>'capture_source', COUNT(*) FROM events WHERE category = 'Diagnostics' GROUP BY properties->>'capture_source' ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	result["capture_sources"] = captureSources

	byVersions, err := s.groupCount(ctx,
		`SELECT properties->>'game_version', COUNT(*) FROM events WHERE category = 'Diagnostics' GROUP BY properties->>'game_version' ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	result["by_game_version"] = byVersions

	return result, nil
}

// DiagnosticsTrend returns daily exception counts for last N days
func (s *Store) DiagnosticsTrend(ctx context.Context, days int) ([]map[string]interface{}, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT DATE(timestamp_utc) AS date, COUNT(*) AS cnt
		FROM events
		WHERE category = 'Diagnostics' AND timestamp_utc >= $1
		GROUP BY DATE(timestamp_utc)
		ORDER BY date ASC
	`, time.Now().UTC().AddDate(0, 0, -days))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trend []map[string]interface{}
	for rows.Next() {
		var date time.Time
		var cnt int
		if err := rows.Scan(&date, &cnt); err != nil {
			return nil, err
		}
		trend = append(trend, map[string]interface{}{
			"date":  date.Format("2006-01-02"),
			"count": cnt,
		})
	}
	return trend, nil
}

// RunHistoryOverview returns run statistics: totals, character usage, win rates, floor/ascension/mode distributions
func (s *Store) RunHistoryOverview(ctx context.Context) (map[string]interface{}, error) {
	result := make(map[string]interface{})

	var totalRuns int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM events WHERE category = 'RunHistory'`).Scan(&totalRuns); err != nil {
		return nil, err
	}
	result["total_runs"] = totalRuns

	var victories int
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM events WHERE category = 'RunHistory'
			AND properties->>'run_character_ids' LIKE '%STSVWB%' AND (properties->>'is_victory')::boolean`).Scan(&victories)
	result["total_victories"] = victories

	var abandoned int
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM events WHERE category = 'RunHistory'
			AND properties->>'run_character_ids' LIKE '%STSVWB%' AND (properties->>'is_abandoned')::boolean`).Scan(&abandoned)
	result["total_abandoned"] = abandoned

	// 角色使用率（从 run_character_ids 中拆解并清理名称）
	charRows, err := s.pool.Query(ctx, `
		SELECT
			regexp_replace(
				regexp_replace(char_id, '^CHARACTER\.', ''),
				'_CHARACTER$', ''
			) AS char_name,
			COUNT(*) AS cnt,
			SUM(CASE WHEN is_victory THEN 1 ELSE 0 END) AS wins,
			SUM(CASE WHEN is_abandoned THEN 1 ELSE 0 END) AS abandoned
		FROM events,
			unnest(string_to_array(regexp_replace(properties->>'run_character_ids', '["\[\],]', '', 'g'), ' ')) AS char_id,
			LATERAL (
				SELECT
					(properties->>'is_victory')::boolean AS is_victory,
					(properties->>'is_abandoned')::boolean AS is_abandoned
			) AS v
	WHERE category = 'RunHistory'
		GROUP BY char_name
		ORDER BY cnt DESC
	`)
	if err != nil {
		return nil, err
	}
	defer charRows.Close()

	characters := make(map[string]int)
	characterWins := make(map[string]int)
	characterAbandoned := make(map[string]int)
	for charRows.Next() {
		var name string
		var cnt, wins, abandoned int
		if err := charRows.Scan(&name, &cnt, &wins, &abandoned); err != nil {
			return nil, err
		}
		// Only include STSVWB characters
		if !strings.Contains(name, "STSVWB_CHARACTER_") {
			continue
		}
		// Clean up STSVWB_CHARACTER_ prefix
		name = strings.Replace(name, "STSVWB_CHARACTER_", "", 1)
		characters[name] = cnt
		characterWins[name] = wins
		characterAbandoned[name] = abandoned
	}
	result["characters"] = characters
	result["character_wins"] = characterWins
	result["character_abandoned"] = characterAbandoned
	// 平均运行时间（只算非放弃对局）
	var avgTime float64
	s.pool.QueryRow(ctx, `SELECT COALESCE(AVG((properties->>'run_time_seconds')::int), 0) FROM events WHERE category = 'RunHistory'
			AND properties->>'run_character_ids' LIKE '%STSVWB%' AND NOT (properties->>'is_abandoned')::boolean`).Scan(&avgTime)
	result["avg_run_time_seconds"] = avgTime

	// 运行时间分布（分桶，分钟）
	timeRows, err := s.pool.Query(ctx, `
		SELECT
			CASE
				WHEN (properties->>'run_time_seconds')::int < 60 THEN '<1分钟'
				WHEN (properties->>'run_time_seconds')::int < 300 THEN '1-5分钟'
				WHEN (properties->>'run_time_seconds')::int < 900 THEN '5-15分钟'
				WHEN (properties->>'run_time_seconds')::int < 1800 THEN '15-30分钟'
				WHEN (properties->>'run_time_seconds')::int < 3600 THEN '30-60分钟'
				ELSE '>60分钟'
			END AS bucket,
			COUNT(*) AS cnt
		FROM events
		WHERE category = 'RunHistory'
			AND properties->>'run_character_ids' LIKE '%STSVWB%'
		GROUP BY bucket
		ORDER BY MIN((properties->>'run_time_seconds')::int)
	`)
	if err != nil {
		return nil, err
	}
	defer timeRows.Close()

	runTimes := make(map[string]int)
	for timeRows.Next() {
		var bucket string
		var cnt int
		if err := timeRows.Scan(&bucket, &cnt); err != nil {
			return nil, err
		}
		runTimes[bucket] = cnt
	}
	result["run_times"] = runTimes

	// 进阶分布
	ascensions, err := s.groupCount(ctx,
		`SELECT properties->>'run_ascension', COUNT(*) FROM events WHERE category = 'RunHistory'
			AND properties->>'run_character_ids' LIKE '%STSVWB%' GROUP BY properties->>'run_ascension' ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	result["ascensions"] = ascensions

	// 游戏模式分布
	modes, err := s.groupCount(ctx,
		`SELECT properties->>'run_game_mode', COUNT(*) FROM events WHERE category = 'RunHistory'
			AND properties->>'run_character_ids' LIKE '%STSVWB%' GROUP BY properties->>'run_game_mode' ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	result["game_modes"] = modes

	cardPickRates, err := s.CardPickRates(ctx)
	if err != nil {
		return nil, err
	}
	result["card_pick_rates"] = cardPickRates

	cardWinRates, err := s.CardWinRates(ctx)
	if err != nil {
		return nil, err
	}
	result["card_win_rates"] = cardWinRates

	return result, nil
}

func (s *Store) CardPickRates(ctx context.Context) ([]CardPickRate, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			card_id,
			offered_count,
			picked_count
		FROM card_pick_stats
		ORDER BY picked_count DESC, offered_count DESC, card_id ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]CardPickRate, 0)
	for rows.Next() {
		var cardID string
		var offered, picked int
		if err := rows.Scan(&cardID, &offered, &picked); err != nil {
			return nil, err
		}
		pickRate := 0.0
		if offered > 0 {
			pickRate = float64(picked) / float64(offered)
		}
		result = append(result, CardPickRate{
			CardID:       cardID,
			CardName:     cardDisplayName(cardID),
			OfferedCount: offered,
			PickedCount:  picked,
			SkippedCount: offered - picked,
			PickRate:     pickRate,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (s *Store) CardWinRates(ctx context.Context) ([]CardWinRate, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			card_id,
			run_count,
			win_count
		FROM card_win_stats
		ORDER BY win_count DESC, run_count DESC, card_id ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]CardWinRate, 0)
	for rows.Next() {
		var cardID string
		var runs, wins int
		if err := rows.Scan(&cardID, &runs, &wins); err != nil {
			return nil, err
		}
		winRate := 0.0
		if runs > 0 {
			winRate = float64(wins) / float64(runs)
		}
		result = append(result, CardWinRate{
			CardID:    cardID,
			CardName:  cardDisplayName(cardID),
			RunCount:  runs,
			WinCount:  wins,
			LossCount: runs - wins,
			WinRate:   winRate,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

// RunTrend returns daily run counts for last N days
func (s *Store) RunTrend(ctx context.Context, days int) ([]map[string]interface{}, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT DATE(timestamp_utc) AS date, COUNT(*) AS cnt
		FROM events
		WHERE category = 'RunHistory'
			AND properties->>'run_character_ids' LIKE '%STSVWB%' AND timestamp_utc >= $1
		GROUP BY DATE(timestamp_utc)
		ORDER BY date ASC
	`, time.Now().UTC().AddDate(0, 0, -days))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trend []map[string]interface{}
	for rows.Next() {
		var date time.Time
		var cnt int
		if err := rows.Scan(&date, &cnt); err != nil {
			return nil, err
		}
		trend = append(trend, map[string]interface{}{
			"date":  date.Format("2006-01-02"),
			"count": cnt,
		})
	}
	return trend, nil
}

// ModInventoryOverview returns mod popularity ranking, load state distribution, and average mod counts
func (s *Store) ModInventoryOverview(ctx context.Context) (map[string]interface{}, error) {
	result := make(map[string]interface{})

	var totalSnapshots int
	s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM events WHERE category = 'ModInventory'`).Scan(&totalSnapshots)
	result["total_snapshots"] = totalSnapshots

	var avgLoaded, avgGameplay, avgDisabled, avgFailed float64
	s.pool.QueryRow(ctx, `SELECT COALESCE(AVG((properties->>'loaded_mod_count')::int), 0) FROM events WHERE category = 'ModInventory'`).Scan(&avgLoaded)
	s.pool.QueryRow(ctx, `SELECT COALESCE(AVG((properties->>'gameplay_mod_count')::int), 0) FROM events WHERE category = 'ModInventory'`).Scan(&avgGameplay)
	s.pool.QueryRow(ctx, `SELECT COALESCE(AVG((properties->>'disabled_mod_count')::int), 0) FROM events WHERE category = 'ModInventory'`).Scan(&avgDisabled)
	s.pool.QueryRow(ctx, `SELECT COALESCE(AVG((properties->>'failed_mod_count')::int), 0) FROM events WHERE category = 'ModInventory'`).Scan(&avgFailed)
	result["avg_loaded"] = avgLoaded
	result["avg_gameplay"] = avgGameplay
	result["avg_disabled"] = avgDisabled
	result["avg_failed"] = avgFailed

	modRows, err := s.pool.Query(ctx, `
		SELECT mod->>'id' AS mod_id, mod->>'name' AS mod_name,
			COUNT(DISTINCT properties->>'anonymous_install_id') AS installs
		FROM events, jsonb_array_elements(payload->'base_payload'->'mods') AS mod
		WHERE category = 'ModInventory'
		GROUP BY mod->>'id', mod->>'name'
		ORDER BY installs DESC
		LIMIT 50
	`)
	if err != nil {
		return nil, err
	}
	defer modRows.Close()

	type ModEntry struct {
		ID       string `json:"id"`
		Name     string `json:"name"`
		Installs int    `json:"installs"`
	}
	var mods []ModEntry
	for modRows.Next() {
		var m ModEntry
		if err := modRows.Scan(&m.ID, &m.Name, &m.Installs); err != nil {
			return nil, err
		}
		mods = append(mods, m)
	}
	result["popular_mods"] = mods

	states, err := s.groupCount(ctx,
		`SELECT mod->>'state', COUNT(*) FROM events, jsonb_array_elements(payload->'base_payload'->'mods') AS mod WHERE category = 'ModInventory' GROUP BY mod->>'state' ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	result["load_states"] = states

	return result, nil
}

// ModInventoryTrend returns daily mod inventory snapshot count
func (s *Store) ModInventoryTrend(ctx context.Context, days int) ([]map[string]interface{}, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT DATE(timestamp_utc) AS date, COUNT(*) AS cnt
		FROM events
		WHERE category = 'ModInventory' AND timestamp_utc >= $1
		GROUP BY DATE(timestamp_utc)
		ORDER BY date ASC
	`, time.Now().UTC().AddDate(0, 0, -days))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trend []map[string]interface{}
	for rows.Next() {
		var date time.Time
		var cnt int
		if err := rows.Scan(&date, &cnt); err != nil {
			return nil, err
		}
		trend = append(trend, map[string]interface{}{
			"date":  date.Format("2006-01-02"),
			"count": cnt,
		})
	}
	return trend, nil
}

// NewInstallsTrend returns daily count of install_ids seen for the first time
func (s *Store) NewInstallsTrend(ctx context.Context, days int) ([]map[string]interface{}, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT DATE(first_seen) AS date, COUNT(*) AS new_installs
		FROM (
			SELECT MIN(timestamp_utc) AS first_seen
			FROM events
			GROUP BY properties->>'anonymous_install_id'
		) sub
		WHERE first_seen >= $1
		GROUP BY DATE(first_seen)
		ORDER BY date ASC
	`, time.Now().UTC().AddDate(0, 0, -days))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trend []map[string]interface{}
	for rows.Next() {
		var date time.Time
		var cnt int
		if err := rows.Scan(&date, &cnt); err != nil {
			return nil, err
		}
		trend = append(trend, map[string]interface{}{
			"date":  date.Format("2006-01-02"),
			"count": cnt,
		})
	}
	return trend, nil
}

// STSVWBVersionUpdateTrend returns daily count of installs that changed STSVWB version
func (s *Store) STSVWBVersionUpdateTrend(ctx context.Context, days int) ([]map[string]interface{}, error) {
	rows, err := s.pool.Query(ctx, `
		WITH stsvwb_snaps AS (
			SELECT
				properties->>'anonymous_install_id' AS install_id,
				timestamp_utc,
				mod->>'version' AS version
			FROM events,
				jsonb_array_elements(payload->'base_payload'->'mods') AS mod
			WHERE category = 'ModInventory' AND mod->>'id' = 'STSVWB'
		),
		versioned AS (
			SELECT
				install_id,
				DATE(timestamp_utc) AS date,
				version,
				LAG(version) OVER (PARTITION BY install_id ORDER BY timestamp_utc) AS prev_version
			FROM stsvwb_snaps
		)
		SELECT date, COUNT(*) AS updates
		FROM versioned
		WHERE version != prev_version AND prev_version IS NOT NULL
			AND date >= $1
		GROUP BY date
		ORDER BY date ASC
	`, time.Now().UTC().AddDate(0, 0, -days))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trend []map[string]interface{}
	for rows.Next() {
		var date time.Time
		var cnt int
		if err := rows.Scan(&date, &cnt); err != nil {
			return nil, err
		}
		trend = append(trend, map[string]interface{}{
			"date":  date.Format("2006-01-02"),
			"count": cnt,
		})
	}
	return trend, nil
}

// ListEvents returns paginated events with optional category filter
func (s *Store) ListEvents(ctx context.Context, category string, page, limit int) ([]model.TelemetryEvent, int, error) {
	var total int
	args := []interface{}{}
	where := ""

	if category != "" {
		where = "WHERE category = $1"
		args = append(args, category)
	}

	err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM events `+where, args...,
	).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	queryArgs := append(args, limit, offset)
	queryIdx := len(args)

	rows, err := s.pool.Query(ctx,
		`SELECT applicant_id, event_name, request_id, category, timestamp_utc, properties, payload
         FROM events `+where+
			` ORDER BY timestamp_utc DESC
         LIMIT $`+fmt.Sprintf("%d", queryIdx+1)+
			` OFFSET $`+fmt.Sprintf("%d", queryIdx+2),
		queryArgs...,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var events []model.TelemetryEvent
	for rows.Next() {
		var evt model.TelemetryEvent
		if err := rows.Scan(
			&evt.ApplicantID, &evt.EventName, &evt.RequestID,
			&evt.Category, &evt.TimestampUtc, &evt.Properties, &evt.Payload,
		); err != nil {
			return nil, 0, err
		}
		events = append(events, evt)
	}

	return events, total, nil
}

func (s *Store) GetConfig(ctx context.Context, key string) (string, error) {
	var value string
	err := s.pool.QueryRow(ctx, `SELECT value FROM config WHERE key = $1`, key).Scan(&value)
	return value, err
}

func (s *Store) SetConfig(ctx context.Context, key, value string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO config (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
		key, value)
	return err
}

func (s *Store) Close() {
	s.pool.Close()
}
