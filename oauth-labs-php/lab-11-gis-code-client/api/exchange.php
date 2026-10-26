<?php
require_once __DIR__ . '/config.php';

$input = json_decode(file_get_contents('php://input'), true);
$code = $input['code'] ?? '';
if (!$code) json_response(['error' => 'missing code'], 400);

// Exchange authorization code for tokens
$tokenResult = http_post('https://oauth2.googleapis.com/token', [
    'code'          => $code,
    'client_id'     => GOOGLE_CLIENT_ID,
    'client_secret' => GOOGLE_CLIENT_SECRET,
    'redirect_uri'  => 'postmessage',
    'grant_type'    => 'authorization_code',
]);

if (!$tokenResult || !isset($tokenResult['access_token'])) {
    json_response(['error' => 'token exchange failed', 'detail' => $tokenResult], 400);
}

$access_token  = $tokenResult['access_token'];
$id_token      = $tokenResult['id_token'] ?? null;
$refresh_token = $tokenResult['refresh_token'] ?? null;

// Fetch user profile
$user = http_get(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    ["Authorization: Bearer $access_token"]
);

json_response([
    'tokens' => [
        'access_token'  => $access_token,
        'id_token'      => $id_token ? substr($id_token, 0, 40) . '...' : null,
        'refresh_token' => $refresh_token,
    ],
    'user' => $user,
]);
