<?php
header('Content-Type: application/json; charset=utf-8');

require_once 'SheetOptimizer.php';

// Обработка запроса
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $action = $_POST['action'] ?? '';
        
        if ($action === 'optimize') {
            $sheets = json_decode($_POST['sheets'], true);
            $margin = intval($_POST['margin']);
            $details = json_decode($_POST['details'], true);
            $strategy = $_POST['strategy'] ?? 'area';
            
            if (!$sheets || !$details) {
                throw new Exception('Некорректный формат данных');
            }
            
            $optimizer = new SheetOptimizer($sheets, $margin, $details, $strategy);
            $result = $optimizer->optimize();
            
            echo json_encode($result);
        } else {
            echo json_encode(['success' => false, 'error' => 'Unknown action']);
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
} else {
    echo json_encode(['success' => false, 'error' => 'Invalid request method']);
}
?>
