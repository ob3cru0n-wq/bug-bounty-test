<?php
require_once __DIR__ . '/config.php';

$nonce = bin2hex(random_bytes(16));
$_SESSION['nonce_hash'] = hash('sha256', $nonce);

json_response(['nonce' => $nonce]);
