<?php
// Collector for the cookieless journey tracking on OakFox's own sites
// (oakfox-ops/tracking/track.src.js). One JSON line per page view, page leave
// or action, in ./data/analytics/sites/<site>/<YYYY-MM>.jsonl.
//
// Nothing is stored on or read from the visitor's device, raw IPs are never
// written, and the visitor code is hash(daily salt + site + IP + browser), so it
// can't be linked across days or across sites. Always answers 204 with no body:
// a rejected hit looks the same as an accepted one.
//
// For oakfox.co.uk it also writes the row the dashboard's Analytics page has
// always read (page views and the named conversions), so that page keeps working.
require_once __DIR__ . '/_analytics_lib.php';

const TRACK_SITES = [
    'oakfox.co.uk' => 'oakfox',
    'cubtrack.co.uk' => 'cubtrack',
    'trailfoxapp.co.uk' => 'trailfox',
    'chesterromans.co.uk' => 'chesterromans',
    'bearlagogaeilge.co.uk' => 'bearlagogaeilge',
];
const TRACK_KEEP_MONTHS = 14;

http_response_code(204);
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') exit;

// The browser says which site the hit came from; nothing else is believed.
$from = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
$host = preg_replace('/^www\./', '', strtolower((string) parse_url($from, PHP_URL_HOST)));
$site = TRACK_SITES[$host] ?? null;
if ($site === null) exit;

$ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
$ip = $_SERVER['REMOTE_ADDR'] ?? '';
if ($ua === '' || $ip === '' || analytics_is_bot($ua) || analytics_is_excluded($ip)) exit;

$in = json_decode((string) file_get_contents('php://input', false, null, 0, 2048), true);
if (!is_array($in)) exit;

$path = (string) ($in['p'] ?? '');
if (!preg_match('#^/[A-Za-z0-9/_.%~-]{0,200}$#', $path)) exit;
if (preg_match('#^/(dashboard|admin|api|brand|sign-off)(/|$)#', $path)) exit;

$kind = (string) ($in['k'] ?? '');
if (!in_array($kind, ['pv', 'lv', 'ev'], true)) exit;

$clean = fn ($v, $len = 80) => mb_substr(trim(preg_replace('/[^\p{L}\p{N} .,:;!?&+%\/\'’()#_-]/u', '', (string) ($v ?? ''))), 0, $len);
$id = preg_match('/^[a-z0-9]{4,10}$/', (string) ($in['i'] ?? '')) ? $in['i'] : '';
$ref = strtolower($clean($in['r'] ?? '', 120));
if ($ref === $host) $ref = '';
$width = (int) ($in['w'] ?? 0);
$device = $width === 0 ? '' : ($width < 768 ? 'mobile' : ($width < 1024 ? 'tablet' : 'desktop'));
$today = analytics_today();

$row = [
    't' => time(),
    'd' => $today,
    'k' => $kind,
    'p' => $path,
    'i' => $id,
    'dev' => $device,
    'v' => substr(hash('sha256', analytics_salt() . '|' . $site . '|' . $ip . '|' . $ua), 0, 16),
];
if ($ref !== '') $row['r'] = $ref;
foreach (['us', 'um', 'uc'] as $k) {
    $v = $clean($in[$k] ?? '');
    if ($v !== '') $row[$k] = $v;
}

$event = '';
if ($kind === 'pv') {
    $row['en'] = empty($in['en']) ? 0 : 1;
} elseif ($kind === 'lv') {
    $row['s'] = max(0, min(1800, (int) ($in['s'] ?? 0)));
    $row['sc'] = max(0, min(100, (int) ($in['sc'] ?? 0)));
} else {
    $event = (string) ($in['e'] ?? '');
    if (!preg_match('/^[a-z0-9_]{1,24}$/', $event)) exit;
    $row['e'] = $event;
    foreach (['l' => 48, 'h' => 120, 'z' => 24] as $k => $len) {
        $v = $clean($in[$k] ?? '', $len);
        if ($v !== '') $row[$k] = $v;
    }
}

$dir = analytics_dir() . '/sites/' . $site;
if (!is_dir($dir)) @mkdir($dir, 0700, true);
@file_put_contents($dir . '/' . substr($today, 0, 7) . '.jsonl', json_encode($row, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);

// Rows older than the keep period go, a month file at a time (checked now and then, not on every hit).
if (random_int(1, 400) === 1) {
    $cutoff = (new DateTimeImmutable('first day of this month'))->modify('-' . TRACK_KEEP_MONTHS . ' months')->format('Y-m');
    // The same rule for the dashboard's own files (analytics_dir()/YYYY-MM.jsonl), so "14 months" is true of both.
    foreach (array_merge(glob($dir . '/*.jsonl') ?: [], glob(analytics_dir() . '/[0-9][0-9][0-9][0-9]-[0-9][0-9].jsonl') ?: []) as $file) {
        if (basename($file, '.jsonl') < $cutoff) @unlink($file);
    }
}

// The dashboard's Analytics page: same row shape as hit.php has always written.
if ($site === 'oakfox' && ($kind === 'pv' || ($kind === 'ev' && in_array($event, ANALYTICS_EVENTS, true)))) {
    // hit.php's own cleaning, so the old file's values look exactly as they always have.
    $old = fn ($v, $len = 80) => mb_substr(preg_replace('/[^\w.\-+ %\/]/u', '', (string) ($v ?? '')), 0, $len);
    analytics_append([
        't' => $row['t'],
        'd' => $today,
        'k' => $kind,
        'e' => $kind === 'ev' ? $event : '',
        'p' => $path,
        'en' => $row['en'] ?? 0,
        'r' => $old($in['r'] ?? '', 120) === 'oakfox.co.uk' ? '' : strtolower($old($in['r'] ?? '', 120)),
        'us' => $old($in['us'] ?? ''),
        'um' => $old($in['um'] ?? ''),
        'uc' => $old($in['uc'] ?? ''),
        'dev' => $device,
        'v' => analytics_visitor_id($ip, $ua),
    ]);
}
