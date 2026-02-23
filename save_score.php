<?php
// Dateiname der Datenbank
$file = 'scores.json';

// Daten vom Spiel empfangen
$data = json_decode(file_get_contents('php://input'), true);

if ($data && isset($data['name']) && isset($data['score'])) {
    // Vorhandene Scores laden
    $scores = [];
    if (file_exists($file)) {
        $scores = json_decode(file_get_contents($file), true);
    }

    // Neuen Score hinzufügen
    $scores[] = [
        'name' => htmlspecialchars($data['name']),
        'points' => (int)$data['score']
    ];

    // Sortieren (Höchste zuerst)
    usort($scores, function($a, $b) {
        return $b['points'] - $a['points'];
    });

    // Nur Top 10 behalten
    $scores = array_slice($scores, 0, 10);

    // Speichern
    file_put_contents($file, json_encode($scores));
    echo json_encode(['status' => 'success']);
} else {
    // Wenn kein POST, dann einfach die Liste ausgeben
    if (file_exists($file)) {
        echo file_get_contents($file);
    } else {
        echo "[]";
    }
}
?>
