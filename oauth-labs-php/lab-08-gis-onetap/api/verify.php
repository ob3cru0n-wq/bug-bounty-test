<?php
require_once __DIR__ . '/config.php';

$input = json_decode(file_get_contents('php://input'), true);
$credential = $input['credential'] ?? '';
if (!$credential) json_response(['error' => 'missing credential'], 400);

$payload = http_get(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($credential)
);

if (!$payload || ($payload['aud'] ?? '') !== GOOGLE_CLIENT_ID) {
    json_response(['error' => 'audience mismatch or invalid token'], 403);
}

json_response($payload);
