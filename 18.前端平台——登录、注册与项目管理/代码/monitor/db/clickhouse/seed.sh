#!/usr/bin/env bash
# =============================================================================
# 前端监控平台 · ClickHouse 模拟数据插入脚本
# 用途：以 JSONEachRow 格式通过 HTTP API 向四张监控表插入测试数据
# 执行方式：bash db/clickhouse/seed.sh
# 前提：ClickHouse 容器运行中（pnpm infra:start）
# =============================================================================

set -e

CH_URL="http://localhost:8123"
CH_USER="monitor"
CH_PASS="123456"
CH_DB="monitor"

insert_json() {
  local table="$1"
  local data="$2"
  echo "$data" | curl -sf -u "${CH_USER}:${CH_PASS}" \
    "${CH_URL}/?database=${CH_DB}&query=INSERT+INTO+${table}+FORMAT+JSONEachRow" \
    --data-binary @-
}

echo "► 开始插入模拟数据..."

# =============================================================================
# error_logs（20 条）
# =============================================================================
echo "  插入 error_logs..."
insert_json "error_logs" '
{"trace_id":"tr-e001","app_id":"app_001","user_id":"user_001","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","error_type":"js_error","message":"Cannot read properties of undefined (reading name)","stack":"TypeError at app.js:42","filename":"https://app.example.com/static/app.js","lineno":42,"colno":15,"created_at":"2026-05-13 09:00:00"}
{"trace_id":"tr-e002","app_id":"app_001","user_id":"user_002","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","error_type":"js_error","message":"Cannot read properties of undefined (reading name)","stack":"TypeError at app.js:42","filename":"https://app.example.com/static/app.js","lineno":42,"colno":15,"created_at":"2026-05-13 08:00:00"}
{"trace_id":"tr-e003","app_id":"app_001","user_id":"user_003","page":"/settings","ua":"Mozilla/5.0 Safari/17","error_type":"js_error","message":"Uncaught ReferenceError: foo is not defined","stack":"ReferenceError at main.js:88","filename":"https://app.example.com/static/main.js","lineno":88,"colno":5,"created_at":"2026-05-13 07:00:00"}
{"trace_id":"tr-e004","app_id":"app_001","user_id":"user_001","page":"/projects","ua":"Mozilla/5.0 Firefox/121","error_type":"promise_error","message":"Network request failed","stack":"","filename":"","lineno":0,"colno":0,"created_at":"2026-05-13 06:00:00"}
{"trace_id":"tr-e005","app_id":"app_001","user_id":"user_004","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","error_type":"resource_error","message":"Failed to load resource","stack":"","filename":"https://app.example.com/static/vendor.js","lineno":0,"colno":0,"created_at":"2026-05-13 05:00:00"}
{"trace_id":"tr-e006","app_id":"app_001","user_id":"user_002","page":"/projects","ua":"Mozilla/5.0 Chrome/120","error_type":"js_error","message":"Cannot read properties of null (reading id)","stack":"TypeError at list.js:12","filename":"https://app.example.com/static/list.js","lineno":12,"colno":8,"created_at":"2026-05-13 04:00:00"}
{"trace_id":"tr-e007","app_id":"app_001","user_id":"user_005","page":"/settings","ua":"Mozilla/5.0 Chrome/120","error_type":"framework_error","message":"Vue component error: render failed","stack":"Error at runtime-core.esm.js","filename":"https://app.example.com/static/vendor.js","lineno":0,"colno":0,"created_at":"2026-05-13 03:00:00"}
{"trace_id":"tr-e008","app_id":"app_001","user_id":"user_001","page":"/dashboard","ua":"Mozilla/5.0 Safari/17","error_type":"js_error","message":"Cannot read properties of undefined (reading name)","stack":"TypeError at app.js:42","filename":"https://app.example.com/static/app.js","lineno":42,"colno":15,"created_at":"2026-05-12 10:00:00"}
{"trace_id":"tr-e009","app_id":"app_001","user_id":"user_003","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","error_type":"js_error","message":"Cannot read properties of undefined (reading name)","stack":"TypeError at app.js:42","filename":"https://app.example.com/static/app.js","lineno":42,"colno":15,"created_at":"2026-05-11 09:00:00"}
{"trace_id":"tr-e010","app_id":"app_001","user_id":"user_002","page":"/projects","ua":"Mozilla/5.0 Chrome/120","error_type":"promise_error","message":"Failed to fetch","stack":"","filename":"","lineno":0,"colno":0,"created_at":"2026-05-11 08:00:00"}
{"trace_id":"tr-e011","app_id":"app_001","user_id":"user_004","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","error_type":"js_error","message":"Uncaught SyntaxError: Unexpected token","stack":"SyntaxError at chunk.js:1","filename":"https://app.example.com/static/chunk.1a2b.js","lineno":1,"colno":0,"created_at":"2026-05-10 09:00:00"}
{"trace_id":"tr-e012","app_id":"app_001","user_id":"user_001","page":"/settings","ua":"Mozilla/5.0 Firefox/121","error_type":"resource_error","message":"Failed to load resource","stack":"","filename":"https://app.example.com/static/icon.png","lineno":0,"colno":0,"created_at":"2026-05-10 08:00:00"}
{"trace_id":"tr-e013","app_id":"app_002","user_id":"user_001","page":"/","ua":"Mozilla/5.0 Chrome/120","error_type":"js_error","message":"Uncaught TypeError: arr.map is not a function","stack":"TypeError at index.js:55","filename":"https://beta.example.com/static/index.js","lineno":55,"colno":18,"created_at":"2026-05-13 08:00:00"}
{"trace_id":"tr-e014","app_id":"app_002","user_id":"user_006","page":"/home","ua":"Mozilla/5.0 Chrome/120","error_type":"js_error","message":"Cannot set property value of null","stack":"TypeError at form.js:30","filename":"https://beta.example.com/static/form.js","lineno":30,"colno":4,"created_at":"2026-05-13 07:00:00"}
{"trace_id":"tr-e015","app_id":"app_002","user_id":"user_007","page":"/profile","ua":"Mozilla/5.0 Safari/17","error_type":"promise_error","message":"AbortError: The user aborted a request","stack":"","filename":"","lineno":0,"colno":0,"created_at":"2026-05-12 10:00:00"}
{"trace_id":"tr-e016","app_id":"app_002","user_id":"user_006","page":"/","ua":"Mozilla/5.0 Chrome/120","error_type":"js_error","message":"Uncaught TypeError: arr.map is not a function","stack":"TypeError at index.js:55","filename":"https://beta.example.com/static/index.js","lineno":55,"colno":18,"created_at":"2026-05-11 09:00:00"}
{"trace_id":"tr-e017","app_id":"app_002","user_id":"user_008","page":"/home","ua":"Mozilla/5.0 Firefox/121","error_type":"resource_error","message":"Failed to load resource","stack":"","filename":"https://beta.example.com/static/logo.svg","lineno":0,"colno":0,"created_at":"2026-05-11 08:00:00"}
{"trace_id":"tr-e018","app_id":"app_001","user_id":"user_003","page":"/projects","ua":"Mozilla/5.0 Chrome/120","error_type":"js_error","message":"Maximum call stack size exceeded","stack":"RangeError at helper.js:9","filename":"https://app.example.com/static/helper.js","lineno":9,"colno":12,"created_at":"2026-05-09 09:00:00"}
{"trace_id":"tr-e019","app_id":"app_001","user_id":"user_005","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","error_type":"framework_error","message":"React: Invalid hook call","stack":"Error at react-dom.js:123","filename":"https://app.example.com/static/vendor.js","lineno":0,"colno":0,"created_at":"2026-05-08 09:00:00"}
{"trace_id":"tr-e020","app_id":"app_002","user_id":"user_007","page":"/profile","ua":"Mozilla/5.0 Chrome/120","error_type":"js_error","message":"Cannot read properties of undefined (reading length)","stack":"TypeError at utils.js:77","filename":"https://beta.example.com/static/utils.js","lineno":77,"colno":20,"created_at":"2026-05-07 09:00:00"}
'

# =============================================================================
# performance_logs（16 条）
# =============================================================================
echo "  插入 performance_logs..."
insert_json "performance_logs" '
{"trace_id":"tr-p001","app_id":"app_001","user_id":"user_001","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","fcp":980.5,"lcp":2100.3,"fid":45.2,"cls":0.05,"ttfb":320.1,"load_time":3200.8,"created_at":"2026-05-13 09:00:00"}
{"trace_id":"tr-p002","app_id":"app_001","user_id":"user_002","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","fcp":1200.0,"lcp":2800.5,"fid":80.0,"cls":0.12,"ttfb":450.3,"load_time":4100.2,"created_at":"2026-05-13 08:00:00"}
{"trace_id":"tr-p003","app_id":"app_001","user_id":"user_003","page":"/projects","ua":"Mozilla/5.0 Safari/17","fcp":750.3,"lcp":1650.8,"fid":20.1,"cls":0.02,"ttfb":210.5,"load_time":2500.0,"created_at":"2026-05-13 07:00:00"}
{"trace_id":"tr-p004","app_id":"app_001","user_id":"user_004","page":"/settings","ua":"Mozilla/5.0 Firefox/121","fcp":890.0,"lcp":1900.2,"fid":35.5,"cls":0.08,"ttfb":280.0,"load_time":2800.5,"created_at":"2026-05-13 06:00:00"}
{"trace_id":"tr-p005","app_id":"app_001","user_id":"user_001","page":"/projects","ua":"Mozilla/5.0 Chrome/120","fcp":650.2,"lcp":1450.0,"fid":15.0,"cls":0.01,"ttfb":180.3,"load_time":2200.1,"created_at":"2026-05-12 10:00:00"}
{"trace_id":"tr-p006","app_id":"app_001","user_id":"user_005","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","fcp":3200.5,"lcp":6500.0,"fid":300.0,"cls":0.45,"ttfb":1200.0,"load_time":8000.0,"created_at":"2026-05-12 09:00:00"}
{"trace_id":"tr-p007","app_id":"app_001","user_id":"user_002","page":"/","ua":"Mozilla/5.0 Safari/17","fcp":420.1,"lcp":980.5,"fid":12.0,"cls":0.00,"ttfb":150.2,"load_time":1800.3,"created_at":"2026-05-11 09:00:00"}
{"trace_id":"tr-p008","app_id":"app_001","user_id":"user_003","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","fcp":1050.0,"lcp":2350.8,"fid":55.3,"cls":0.09,"ttfb":350.0,"load_time":3600.7,"created_at":"2026-05-10 09:00:00"}
{"trace_id":"tr-p009","app_id":"app_002","user_id":"user_006","page":"/","ua":"Mozilla/5.0 Chrome/120","fcp":520.0,"lcp":1200.5,"fid":18.5,"cls":0.03,"ttfb":160.0,"load_time":2000.0,"created_at":"2026-05-13 09:00:00"}
{"trace_id":"tr-p010","app_id":"app_002","user_id":"user_007","page":"/home","ua":"Mozilla/5.0 Safari/17","fcp":680.3,"lcp":1550.0,"fid":25.0,"cls":0.04,"ttfb":220.5,"load_time":2400.8,"created_at":"2026-05-13 08:00:00"}
{"trace_id":"tr-p011","app_id":"app_002","user_id":"user_008","page":"/profile","ua":"Mozilla/5.0 Chrome/120","fcp":820.5,"lcp":1800.2,"fid":40.0,"cls":0.06,"ttfb":260.3,"load_time":2900.1,"created_at":"2026-05-12 09:00:00"}
{"trace_id":"tr-p012","app_id":"app_002","user_id":"user_006","page":"/home","ua":"Mozilla/5.0 Firefox/121","fcp":2500.0,"lcp":5200.5,"fid":200.0,"cls":0.38,"ttfb":980.0,"load_time":7000.5,"created_at":"2026-05-11 09:00:00"}
{"trace_id":"tr-p013","app_id":"app_001","user_id":"user_004","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","fcp":900.0,"lcp":1950.0,"fid":42.0,"cls":0.07,"ttfb":300.5,"load_time":3100.0,"created_at":"2026-05-09 09:00:00"}
{"trace_id":"tr-p014","app_id":"app_001","user_id":"user_001","page":"/settings","ua":"Mozilla/5.0 Chrome/120","fcp":780.5,"lcp":1720.3,"fid":30.2,"cls":0.04,"ttfb":240.0,"load_time":2700.8,"created_at":"2026-05-08 09:00:00"}
{"trace_id":"tr-p015","app_id":"app_002","user_id":"user_007","page":"/","ua":"Mozilla/5.0 Chrome/120","fcp":610.2,"lcp":1380.5,"fid":22.0,"cls":0.03,"ttfb":190.0,"load_time":2150.3,"created_at":"2026-05-07 09:00:00"}
{"trace_id":"tr-p016","app_id":"app_001","user_id":"user_005","page":"/projects","ua":"Mozilla/5.0 Safari/17","fcp":1100.5,"lcp":2450.0,"fid":60.5,"cls":0.11,"ttfb":380.0,"load_time":3900.2,"created_at":"2026-05-06 09:00:00"}
'

# =============================================================================
# behavior_logs（20 条）
# =============================================================================
echo "  插入 behavior_logs..."
insert_json "behavior_logs" '
{"trace_id":"tr-b001","app_id":"app_001","user_id":"user_001","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","action_type":"page_view","element":"","extra":"","created_at":"2026-05-13 09:00:00"}
{"trace_id":"tr-b002","app_id":"app_001","user_id":"user_001","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","action_type":"click","element":"button#create-project","extra":"","created_at":"2026-05-13 09:01:00"}
{"trace_id":"tr-b003","app_id":"app_001","user_id":"user_001","page":"/projects","ua":"Mozilla/5.0 Chrome/120","action_type":"page_view","element":"","extra":"","created_at":"2026-05-13 09:02:00"}
{"trace_id":"tr-b004","app_id":"app_001","user_id":"user_002","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","action_type":"page_view","element":"","extra":"","created_at":"2026-05-13 08:00:00"}
{"trace_id":"tr-b005","app_id":"app_001","user_id":"user_002","page":"/settings","ua":"Mozilla/5.0 Chrome/120","action_type":"click","element":"a.nav-link[href=/settings]","extra":"","created_at":"2026-05-13 08:05:00"}
{"trace_id":"tr-b006","app_id":"app_001","user_id":"user_003","page":"/dashboard","ua":"Mozilla/5.0 Safari/17","action_type":"page_view","element":"","extra":"","created_at":"2026-05-13 07:00:00"}
{"trace_id":"tr-b007","app_id":"app_001","user_id":"user_003","page":"/dashboard","ua":"Mozilla/5.0 Safari/17","action_type":"custom","element":"","extra":"{\"event\":\"upgrade_clicked\",\"plan\":\"pro\"}","created_at":"2026-05-13 07:05:00"}
{"trace_id":"tr-b008","app_id":"app_001","user_id":"user_004","page":"/projects","ua":"Mozilla/5.0 Firefox/121","action_type":"page_view","element":"","extra":"","created_at":"2026-05-13 06:00:00"}
{"trace_id":"tr-b009","app_id":"app_001","user_id":"user_004","page":"/projects","ua":"Mozilla/5.0 Firefox/121","action_type":"click","element":"button.delete-btn[data-id=proj-42]","extra":"","created_at":"2026-05-13 06:05:00"}
{"trace_id":"tr-b010","app_id":"app_001","user_id":"user_005","page":"/settings","ua":"Mozilla/5.0 Chrome/120","action_type":"page_view","element":"","extra":"","created_at":"2026-05-13 05:00:00"}
{"trace_id":"tr-b011","app_id":"app_001","user_id":"user_001","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","action_type":"page_view","element":"","extra":"","created_at":"2026-05-12 09:00:00"}
{"trace_id":"tr-b012","app_id":"app_001","user_id":"user_002","page":"/projects","ua":"Mozilla/5.0 Chrome/120","action_type":"page_view","element":"","extra":"","created_at":"2026-05-12 08:00:00"}
{"trace_id":"tr-b013","app_id":"app_001","user_id":"user_001","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","action_type":"custom","element":"","extra":"{\"event\":\"feature_used\",\"name\":\"alert_rule\"}","created_at":"2026-05-12 07:00:00"}
{"trace_id":"tr-b014","app_id":"app_001","user_id":"user_003","page":"/settings","ua":"Mozilla/5.0 Safari/17","action_type":"page_view","element":"","extra":"","created_at":"2026-05-11 09:00:00"}
{"trace_id":"tr-b015","app_id":"app_001","user_id":"user_004","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","action_type":"page_view","element":"","extra":"","created_at":"2026-05-10 09:00:00"}
{"trace_id":"tr-b016","app_id":"app_002","user_id":"user_006","page":"/","ua":"Mozilla/5.0 Chrome/120","action_type":"page_view","element":"","extra":"","created_at":"2026-05-13 09:00:00"}
{"trace_id":"tr-b017","app_id":"app_002","user_id":"user_006","page":"/","ua":"Mozilla/5.0 Chrome/120","action_type":"click","element":"button#get-started","extra":"","created_at":"2026-05-13 09:05:00"}
{"trace_id":"tr-b018","app_id":"app_002","user_id":"user_007","page":"/home","ua":"Mozilla/5.0 Safari/17","action_type":"page_view","element":"","extra":"","created_at":"2026-05-13 08:00:00"}
{"trace_id":"tr-b019","app_id":"app_002","user_id":"user_008","page":"/profile","ua":"Mozilla/5.0 Firefox/121","action_type":"page_view","element":"","extra":"","created_at":"2026-05-12 09:00:00"}
{"trace_id":"tr-b020","app_id":"app_002","user_id":"user_007","page":"/","ua":"Mozilla/5.0 Chrome/120","action_type":"custom","element":"","extra":"{\"event\":\"signup_started\"}","created_at":"2026-05-12 08:00:00"}
'

# =============================================================================
# api_logs（20 条）
# =============================================================================
echo "  插入 api_logs..."
insert_json "api_logs" '
{"trace_id":"tr-a001","app_id":"app_001","user_id":"user_001","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","method":"GET","url":"https://api.example.com/projects","status":200,"duration":235.5,"request_size":0,"response_size":1240,"success":true,"created_at":"2026-05-13 09:00:00"}
{"trace_id":"tr-a002","app_id":"app_001","user_id":"user_001","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","method":"GET","url":"https://api.example.com/alerts/summary","status":200,"duration":180.2,"request_size":0,"response_size":580,"success":true,"created_at":"2026-05-13 09:01:00"}
{"trace_id":"tr-a003","app_id":"app_001","user_id":"user_002","page":"/projects","ua":"Mozilla/5.0 Chrome/120","method":"POST","url":"https://api.example.com/projects","status":201,"duration":320.8,"request_size":850,"response_size":420,"success":true,"created_at":"2026-05-13 08:00:00"}
{"trace_id":"tr-a004","app_id":"app_001","user_id":"user_003","page":"/settings","ua":"Mozilla/5.0 Safari/17","method":"PUT","url":"https://api.example.com/user/profile","status":200,"duration":290.0,"request_size":480,"response_size":220,"success":true,"created_at":"2026-05-13 07:00:00"}
{"trace_id":"tr-a005","app_id":"app_001","user_id":"user_004","page":"/projects","ua":"Mozilla/5.0 Firefox/121","method":"GET","url":"https://api.example.com/projects/42","status":404,"duration":95.3,"request_size":0,"response_size":180,"success":false,"created_at":"2026-05-13 06:00:00"}
{"trace_id":"tr-a006","app_id":"app_001","user_id":"user_002","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","method":"GET","url":"https://api.example.com/errors?range=24h","status":200,"duration":2850.5,"request_size":0,"response_size":15200,"success":true,"created_at":"2026-05-13 05:00:00"}
{"trace_id":"tr-a007","app_id":"app_001","user_id":"user_001","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","method":"GET","url":"https://api.example.com/performance","status":500,"duration":8500.0,"request_size":0,"response_size":320,"success":false,"created_at":"2026-05-13 04:00:00"}
{"trace_id":"tr-a008","app_id":"app_001","user_id":"user_005","page":"/settings","ua":"Mozilla/5.0 Chrome/120","method":"DELETE","url":"https://api.example.com/projects/15","status":403,"duration":88.0,"request_size":0,"response_size":210,"success":false,"created_at":"2026-05-13 03:00:00"}
{"trace_id":"tr-a009","app_id":"app_001","user_id":"user_003","page":"/dashboard","ua":"Mozilla/5.0 Safari/17","method":"GET","url":"https://api.example.com/projects","status":200,"duration":310.5,"request_size":0,"response_size":1580,"success":true,"created_at":"2026-05-12 09:00:00"}
{"trace_id":"tr-a010","app_id":"app_001","user_id":"user_001","page":"/projects","ua":"Mozilla/5.0 Chrome/120","method":"GET","url":"https://api.example.com/errors?range=7d","status":200,"duration":4200.0,"request_size":0,"response_size":28000,"success":true,"created_at":"2026-05-12 08:00:00"}
{"trace_id":"tr-a011","app_id":"app_001","user_id":"user_004","page":"/dashboard","ua":"Mozilla/5.0 Firefox/121","method":"GET","url":"https://api.example.com/alerts/summary","status":200,"duration":155.3,"request_size":0,"response_size":620,"success":true,"created_at":"2026-05-11 09:00:00"}
{"trace_id":"tr-a012","app_id":"app_001","user_id":"user_002","page":"/settings","ua":"Mozilla/5.0 Chrome/120","method":"POST","url":"https://api.example.com/alerts","status":201,"duration":410.8,"request_size":720,"response_size":380,"success":true,"created_at":"2026-05-11 08:00:00"}
{"trace_id":"tr-a013","app_id":"app_001","user_id":"user_001","page":"/dashboard","ua":"Mozilla/5.0 Chrome/120","method":"GET","url":"https://api.example.com/performance","status":0,"duration":0.0,"request_size":0,"response_size":-1,"success":false,"created_at":"2026-05-10 09:00:00"}
{"trace_id":"tr-a014","app_id":"app_002","user_id":"user_006","page":"/","ua":"Mozilla/5.0 Chrome/120","method":"GET","url":"https://api.beta.com/config","status":200,"duration":120.5,"request_size":0,"response_size":880,"success":true,"created_at":"2026-05-13 09:00:00"}
{"trace_id":"tr-a015","app_id":"app_002","user_id":"user_006","page":"/","ua":"Mozilla/5.0 Chrome/120","method":"POST","url":"https://api.beta.com/auth/login","status":200,"duration":380.2,"request_size":640,"response_size":520,"success":true,"created_at":"2026-05-13 09:05:00"}
{"trace_id":"tr-a016","app_id":"app_002","user_id":"user_007","page":"/home","ua":"Mozilla/5.0 Safari/17","method":"GET","url":"https://api.beta.com/feed","status":200,"duration":560.0,"request_size":0,"response_size":3200,"success":true,"created_at":"2026-05-13 08:00:00"}
{"trace_id":"tr-a017","app_id":"app_002","user_id":"user_008","page":"/profile","ua":"Mozilla/5.0 Firefox/121","method":"GET","url":"https://api.beta.com/user/me","status":401,"duration":75.5,"request_size":0,"response_size":180,"success":false,"created_at":"2026-05-12 09:00:00"}
{"trace_id":"tr-a018","app_id":"app_002","user_id":"user_006","page":"/home","ua":"Mozilla/5.0 Chrome/120","method":"GET","url":"https://api.beta.com/feed","status":200,"duration":2100.5,"request_size":0,"response_size":8800,"success":true,"created_at":"2026-05-11 09:00:00"}
{"trace_id":"tr-a019","app_id":"app_001","user_id":"user_003","page":"/projects","ua":"Mozilla/5.0 Chrome/120","method":"GET","url":"https://api.example.com/projects","status":200,"duration":280.0,"request_size":0,"response_size":1100,"success":true,"created_at":"2026-05-09 09:00:00"}
{"trace_id":"tr-a020","app_id":"app_001","user_id":"user_005","page":"/dashboard","ua":"Mozilla/5.0 Safari/17","method":"GET","url":"https://api.example.com/errors?range=24h","status":503,"duration":30000.0,"request_size":0,"response_size":480,"success":false,"created_at":"2026-05-07 09:00:00"}
'

# =============================================================================
# 验证插入结果
# =============================================================================
echo ""
echo "► 验证数据行数..."
curl -sf -u "${CH_USER}:${CH_PASS}" \
  "${CH_URL}/?database=${CH_DB}&query=SELECT+%27error_logs%27+AS+tbl%2C+count()%2B0+AS+rows+FROM+error_logs+UNION+ALL+SELECT+%27performance_logs%27%2C+count()%2B0+FROM+performance_logs+UNION+ALL+SELECT+%27behavior_logs%27%2C+count()%2B0+FROM+behavior_logs+UNION+ALL+SELECT+%27api_logs%27%2C+count()%2B0+FROM+api_logs"
echo ""
echo "✓ 模拟数据插入完成"
