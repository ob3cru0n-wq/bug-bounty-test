<?php
require_once __DIR__ . '/config.php';

$token = $_GET['access_token'] ?? '';
if (!$token) json_response(['error' => 'missing access_token'], 400);

$user = http_get(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    ["Authorization: Bearer $token"]
);

json_response($user ?: ['error' => 'upstream error']);
