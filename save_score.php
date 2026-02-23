<?php
header('Content-Type: application/json');
$file = 'scores.json';
$data = json_decode(file_get_contents('php://input'), true);

if ($data) {
    $scores = file_exists($file) ? json_decode(file_get_contents($file), true) : [];
    $scores[] = ['name' => htmlspecialchars($data['name']), 'points' => (int)$data['score']];
    usort($scores, function($a, $b) { return $b['points'] - $a['points']; });
    $scores = array_slice($scores, 0, 10);
    file_put_contents($file, json_encode($scores));
    echo json_encode($scores);
} else {
    echo file_exists($file) ? file_get_contents($file) : json_encode([]);
}
?>
