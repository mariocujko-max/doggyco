<?php
// Aktiviert Fehlermeldungen für die Diagnose (kann später gelöscht werden)
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Erlaubt Zugriff von verschiedenen Geräten
header('Access-Control-Allow-Methods: POST, GET');

$file = 'scores.json';

// 1. Daten empfangen
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// 2. Bestehende Scores laden
$scores = [];
if (file_exists($file)) {
    $content = file_get_contents($file);
    $scores = json_decode($content, true);
    if (!is_array($scores)) $scores = [];
}

// 3. Wenn neue Daten kommen: Speichern
if ($data && isset($data['name']) && isset($data['score'])) {
    $newEntry = [
        'name' => htmlspecialchars(substr($data['name'], 0, 15)), // Name kürzen zur Sicherheit
        'points' => (int)$data['score']
    ];
    
    $scores[] = $newEntry;

    // Sortieren: Höchste Punktzahl zuerst
    usort($scores, function($a, $b) {
        return $b['points'] - $a['points'];
    });

    // Nur die besten 10 behalten
    $scores = array_slice($scores, 0, 10);

    // In Datei schreiben
    if (!file_put_contents($file, json_encode($scores))) {
        // Falls der Server nicht schreiben darf
        http_response_code(500);
        echo json_encode(["error" => "Datei nicht schreibbar. CHMOD 777 prüfen!"]);
        exit;
    }
}

// 4. Aktuelle Liste ausgeben
echo json_encode($scores);
?>
