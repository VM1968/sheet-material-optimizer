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
        
        // Развернуть детали с учетом количества
        foreach ($this->details as $detail) {
            for ($i = 0; $i < $detail['quantity']; $i++) {
                $remaining_details[] = [
                    'length' => $detail['length'],
                    'width' => $detail['width'],
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
        
        $material_used = ($used_area / $total_sheet_area) * 100;
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
            'available_width' => $this->sheet_width,
            'available_length' => $this->sheet_length
        ];
        
        $current_y = 0;
        
        while (!empty($remaining_details) && $current_y < $this->sheet_width) {
            $detail = array_shift($remaining_details);
            $current_x = 0;
            $current_row_height = 0;
            
            // Пытаемся разместить детали в текущей строке
            while (!empty($remaining_details) || $detail) {
                $length = $detail ? $detail['length'] : null;
                $width = $detail ? $detail['width'] : null;
                
                if (!$length) break;
                
                // Проверяем оба варианта ориентации
                $fits_normal = ($length + $this->margin <= $this->sheet_length - $current_x) &&
                               ($width + $this->margin <= $this->sheet_width - $current_y);
                
                $fits_rotated = ($width + $this->margin <= $this->sheet_length - $current_x) &&
                                ($length + $this->margin <= $this->sheet_width - $current_y);
                
                if ($fits_normal) {
                    // Разместить в нормальной ориентации
                    $pattern['details'][] = [
                        'x' => $current_x,
                        'y' => $current_y,
                        'length' => $length,
                        'width' => $width
                    ];
                    
                    $pattern['used_area'] += $length * $width;
                    $current_x += $length + $this->margin;
                    $current_row_height = max($current_row_height, $width);
                    
                    $detail = array_shift($remaining_details);
                } elseif ($fits_rotated && $width + $this->margin <= $this->sheet_length - $current_x) {
                    // Разместить в повернутой ориентации
                    $pattern['details'][] = [
                        'x' => $current_x,
                        'y' => $current_y,
                        'length' => $width,
                        'width' => $length
                    ];
                    
                    $pattern['used_area'] += $length * $width;
                    $current_x += $width + $this->margin;
                    $current_row_height = max($current_row_height, $length);
                    
                    $detail = array_shift($remaining_details);
                } else {
                    // Не подходит, переместить в начало конца очереди
                    if ($detail) {
                        array_push($remaining_details, $detail);
                    }
                    break;
                }
            }
            
            $current_y += $current_row_height + $this->margin;
            
            if (!$detail && !empty($remaining_details)) {
                $detail = reset($remaining_details);
            } elseif ($detail && empty($remaining_details)) {
                array_push($remaining_details, $detail);
                break;
            }
        }
        
        return $pattern;
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