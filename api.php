<?php
header('Content-Type: application/json; charset=utf-8');

class SheetOptimizer {
    private $sheet_length;
    private $sheet_width;
    private $material_cost;
    private $margin;
    private $details;
    
    public function __construct($sheet_length, $sheet_width, $material_cost, $margin, $details) {
        $this->sheet_length = $sheet_length;
        $this->sheet_width = $sheet_width;
        $this->material_cost = $material_cost;
        $this->margin = $margin;
        $this->details = $details;
    }
    
    /**
     * Основной метод оптимизации раскроя
     */
    public function optimize() {
        $patterns = [];
        $remaining_details = [];
        
        // Развернуть детали с учетом количества и ротации
        foreach ($this->details as $detail) {
            for ($i = 0; $i < $detail['quantity']; $i++) {
                $remaining_details[] = [
                    'length' => $detail['length'],
                    'width' => $detail['width'],
                    'rotation' => $detail['rotation'] ?? 'free',
                    'original_index' => count($remaining_details)
                ];
            }
        }
        
        // Сортировать детали по площади (больше сначала)
        usort($remaining_details, function($a, $b) {
            $area_a = $a['length'] * $a['width'];
            $area_b = $b['length'] * $b['width'];
            return $area_b - $area_a;
        });
        
        // Генерировать схемы раскроя
        while (!empty($remaining_details)) {
            $pattern = $this->createPattern($remaining_details);
            if (!empty($pattern['details'])) {
                $patterns[] = $pattern;
            } else {
                // Если не удалось разместить ни одну деталь, выходим (ошибка)
                break;
            }
        }
        
        // Расчет статистики
        $total_sheets = count($patterns);
        $total_cost = $total_sheets * $this->material_cost;
        $sheet_area = $this->sheet_length * $this->sheet_width;
        $total_sheet_area = $total_sheets * $sheet_area;
        
        // Расчет использованной площади
        $used_area = 0;
        foreach ($patterns as $pattern) {
            $used_area += $pattern['used_area'];
        }
        
        $material_used = $total_sheet_area > 0 ? ($used_area / $total_sheet_area) * 100 : 0;
        $waste = 100 - $material_used;
        
        return [
            'success' => true,
            'sheets_needed' => $total_sheets,
            'total_cost' => $total_cost,
            'material_used' => $material_used,
            'waste' => $waste,
            'sheet_length' => $this->sheet_length,
            'sheet_width' => $this->sheet_width,
            'margin' => $this->margin,
            'patterns' => $patterns
        ];
    }
    
    /**
     * Создать одну схему раскроя
     */
    private function createPattern(&$remaining_details) {
        $pattern = [
            'details' => [],
            'used_area' => 0,
        ];
        
        $used_spaces = []; // Отслеживание использованного пространства
        
        while (!empty($remaining_details)) {
            $detail = array_shift($remaining_details);
            $placed = false;
            
            // Пытаемся найти место для детали
            $position = $this->findBestPosition($pattern, $detail, $used_spaces);
            
            if ($position !== null) {
                // Деталь размещена успешно
                $pattern['details'][] = [
                    'x' => $position['x'],
                    'y' => $position['y'],
                    'length' => $position['length'],
                    'width' => $position['width']
                ];
                
                $pattern['used_area'] += $position['length'] * $position['width'];
                $used_spaces[] = $position;
                $placed = true;
            }
            
            if (!$placed) {
                // Вернуть деталь в очередь - не подходит
                array_unshift($remaining_details, $detail);
                break;
            }
        }
        
        return $pattern;
    }
    
    /**
     * Найти лучшую позицию для детали на листе
     */
    private function findBestPosition($pattern, $detail, $used_spaces) {
        $best_position = null;
        $best_waste = PHP_INT_MAX;
        
        // Пытаемся разместить деталь в нормальной ориентации
        $normal_positions = $this->getAvailablePositions(
            $detail['length'], 
            $detail['width'], 
            $pattern, 
            $used_spaces
        );
        
        foreach ($normal_positions as $pos) {
            if ($this->canPlaceDetail($pos['x'], $pos['y'], $detail['length'], $detail['width'], $used_spaces)) {
                return [
                    'x' => $pos['x'],
                    'y' => $pos['y'],
                    'length' => $detail['length'],
                    'width' => $detail['width']
                ];
            }
        }
        
        // Если деталь имеет свободную ротацию, пытаемся развернуть
        if ($detail['rotation'] === 'free') {
            $rotated_positions = $this->getAvailablePositions(
                $detail['width'], 
                $detail['length'], 
                $pattern, 
                $used_spaces
            );
            
            foreach ($rotated_positions as $pos) {
                if ($this->canPlaceDetail($pos['x'], $pos['y'], $detail['width'], $detail['length'], $used_spaces)) {
                    return [
                        'x' => $pos['x'],
                        'y' => $pos['y'],
                        'length' => $detail['width'],
                        'width' => $detail['length']
                    ];
                }
            }
        }
        
        return null;
    }
    
    /**
     * Получить доступные позиции для размещения детали
     */
    private function getAvailablePositions($length, $width, $pattern, $used_spaces) {
        $positions = [];
        
        // Стартовые позиции: левый верхний угол и вдоль краев существующих деталей
        $positions[] = ['x' => 0, 'y' => 0];
        
        // Позиции вдоль краев уже размещенных деталей
        foreach ($pattern['details'] as $placed_detail) {
            // Справа от детали
            $x = $placed_detail['x'] + $placed_detail['length'] + $this->margin;
            $y = $placed_detail['y'];
            if ($x + $length + $this->margin <= $this->sheet_length && 
                $y + $width + $this->margin <= $this->sheet_width) {
                $positions[] = ['x' => $x, 'y' => $y];
            }
            
            // Снизу от детали
            $x = $placed_detail['x'];
            $y = $placed_detail['y'] + $placed_detail['width'] + $this->margin;
            if ($x + $length + $this->margin <= $this->sheet_length && 
                $y + $width + $this->margin <= $this->sheet_width) {
                $positions[] = ['x' => $x, 'y' => $y];
            }
        }
        
        // Также проверяем сетку позиций
        for ($x = 0; $x + $length + $this->margin <= $this->sheet_length; $x += 50) {
            for ($y = 0; $y + $width + $this->margin <= $this->sheet_width; $y += 50) {
                $positions[] = ['x' => $x, 'y' => $y];
            }
        }
        
        return $positions;
    }
    
    /**
     * Проверить, может ли деталь быть размещена в указанной позиции
     */
    private function canPlaceDetail($x, $y, $length, $width, $used_spaces) {
        // Проверить границы листа
        if ($x + $length + $this->margin > $this->sheet_length) {
            return false;
        }
        if ($y + $width + $this->margin > $this->sheet_width) {
            return false;
        }
        
        // Проверить пересечение с существующими деталями
        foreach ($used_spaces as $space) {
            if ($this->isOverlapping(
                $x, $y, $length, $width,
                $space['x'], $space['y'], $space['length'], $space['width']
            )) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Проверить пересечение двух прямоугольников
     */
    private function isOverlapping($x1, $y1, $w1, $h1, $x2, $y2, $w2, $h2) {
        $x1_end = $x1 + $w1 + $this->margin;
        $y1_end = $y1 + $h1 + $this->margin;
        $x2_end = $x2 + $w2 + $this->margin;
        $y2_end = $y2 + $h2 + $this->margin;
        
        return !(
            $x1_end <= $x2 ||
            $x2_end <= $x1 ||
            $y1_end <= $y2 ||
            $y2_end <= $y1
        );
    }
}

// Обработка запроса
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $action = $_POST['action'] ?? '';
        
        if ($action === 'optimize') {
            $sheet_length = intval($_POST['sheet_length']);
            $sheet_width = intval($_POST['sheet_width']);
            $material_cost = floatval($_POST['material_cost']);
            $margin = intval($_POST['margin']);
            $details = json_decode($_POST['details'], true);
            
            if (!$details) {
                throw new Exception('Некорректный формат данных деталей');
            }
            
            $optimizer = new SheetOptimizer($sheet_length, $sheet_width, $material_cost, $margin, $details);
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
