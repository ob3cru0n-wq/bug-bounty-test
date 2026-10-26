<?php
// Google OAuth credentials — set these to your values
define('GOOGLE_CLIENT_ID', getenv('GOOGLE_CLIENT_ID') ?: 'YOUR_CLIENT_ID');
define('GOOGLE_CLIENT_SECRET', getenv('GOOGLE_CLIENT_SECRET') ?: 'YOUR_CLIENT_SECRET');
define('BASE_URL', 'https://oauth-labs.h4ackerman.website');

// Helper: make a GET request and return decoded JSON
function http_get($url, $headers = []) {
    $opts = ['http' => [
        'method' => 'GET',
        'header' => implode("\r\n", $headers),
        'ignore_errors' => true,
        'timeout' => 10,
    ]];
    $ctx = stream_context_create($opts);
    $body = file_get_contents($url, false, $ctx);
    return json_decode($body, true);
}

// Helper: make a POST request and return decoded JSON
function http_post($url, $data, $headers = []) {
    $content = is_string($data) ? $data : http_build_query($data);
    $defaultHeaders = ['Content-Type: application/x-www-form-urlencoded'];
    $opts = ['http' => [
        'method' => 'POST',
        'header' => implode("\r\n", array_merge($defaultHeaders, $headers)),
        'content' => $content,
        'ignore_errors' => true,
        'timeout' => 10,
    ]];
    $ctx = stream_context_create($opts);
    $body = file_get_contents($url, false, $ctx);
    return json_decode($body, true);
}

// Helper: return JSON response
function json_response($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}
