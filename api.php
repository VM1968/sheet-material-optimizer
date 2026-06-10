<?php
header('Content-Type: application/json; charset=utf-8');

class SheetOptimizer {
    private $sheets;
    private $margin;
    private $details;
    private $strategy;
    
    public function __construct($sheets, $margin, $details, $strategy = 'area') {
        $this->sheets = $sheets;
        $this->margin = $margin;
        $this->details = $details;
        $this->strategy = $strategy;
    }
    
    /**
     * Основной метод оптимизации раскроя для всех листов
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
        
        // Сортировать детали в зависимости от стратегии
        $remaining_details = $this->sortDetails($remaining_details);
        
        // Генерировать схемы раскроя для всех листов
        $sheet_index = 0;
        while (!empty($remaining_details) && $sheet_index < count($this->sheets)) {
            $current_sheet = $this->sheets[$sheet_index];
            $pattern = $this->createPattern($remaining_details, $current_sheet);
            
            if (!empty($pattern['details'])) {
                $pattern['sheet_index'] = $sheet_index;
                $pattern['sheet_length'] = $current_sheet['length'];
                $pattern['sheet_width'] = $current_sheet['width'];
                $pattern['material_cost'] = $current_sheet['cost'];
                $patterns[] = $pattern;
            } else {
                // Если на текущий лист ничего не поместилось, переходим к следующему
                $sheet_index++;
                if ($sheet_index >= count($this->sheets)) {
                    break;
                }
            }
        }
        
        // Если остались детали, которые не поместились ни на один лист
        if (!empty($remaining_details)) {
            return [
                'success' => false,
                'error' => 'Не удалось разместить все детали на доступные листы материала. Требуется больше материала.'
            ];
        }
        
        // Расчет статистики
        $total_sheets_used = count($patterns);
        $total_cost = 0;
        $total_sheet_area = 0;
        $used_area = 0;
        
        foreach ($patterns as $pattern) {
            $total_cost += $pattern['material_cost'];
            $sheet_area = $pattern['sheet_length'] * $pattern['sheet_width'];
            $total_sheet_area += $sheet_area;
            $used_area += $pattern['used_area'];
        }
        
        $material_used = $total_sheet_area > 0 ? ($used_area / $total_sheet_area) * 100 : 0;
        $waste = 100 - $material_used;
        
        return [
            'success' => true,
            'strategy' => $this->strategy,
            'sheets_used' => $total_sheets_used,
            'total_cost' => $total_cost,
            'material_used' => $material_used,
            'waste' => $waste,
            'total_sheet_area' => $total_sheet_area,
            'used_area' => $used_area,
            'patterns' => $patterns
        ];
    }
    
    /**
     * Сортировка деталей в зависимости от стратегии
     */
    private function sortDetails(&$details) {
        switch ($this->strategy) {
            case 'long_side':
                // Сортировка по длинной стороне
                usort($details, function($a, $b) {
                    $long_a = max($a['length'], $a['width']);
                    $long_b = max($b['length'], $b['width']);
                    return $long_b - $long_a;
                });
                break;
            
            case 'best_fit':
                // Сортировка по периметру
                usort($details, function($a, $b) {
                    $perim_a = 2 * ($a['length'] + $a['width']);
                    $perim_b = 2 * ($b['length'] + $b['width']);
                    return $perim_b - $perim_a;
                });
                break;
            
            case 'area':
            default:
                // Сортировка по площади (больше сначала)
                usort($details, function($a, $b) {
                    $area_a = $a['length'] * $a['width'];
                    $area_b = $b['length'] * $b['width'];
                    return $area_b - $area_a;
                });
                break;
        }
        
        return $details;
    }
    
    /**
     * Создать одну схему раскроя на конкретном листе
     */
    private function createPattern(&$remaining_details, $sheet) {
        $pattern = [
            'details' => [],
            'used_area' => 0,
        ];
        
        $used_spaces = []; // Отслеживание использованного пространства
        
        while (!empty($remaining_details)) {
            $detail = array_shift($remaining_details);
            $placed = false;
            
            // Пытаемся найти место для детали
            $position = $this->findBestPosition($pattern, $detail, $used_spaces, $sheet);
            
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
                // Вернуть деталь в очередь - не подходит на текущий лист
                array_unshift($remaining_details, $detail);
                break;
            }
        }
        
        return $pattern;
    }
    
    /**
     * Найти лучшую позицию для детали на листе
     */
    private function findBestPosition($pattern, $detail, $used_spaces, $sheet) {
        $best_position = null;
        $best_waste = PHP_INT_MAX;
        
        // Пытаемся разместить деталь в нормальной ориентации
        $normal_positions = $this->getAvailablePositions(
            $detail['length'], 
            $detail['width'], 
            $pattern, 
            $used_spaces,
            $sheet
        );
        
        foreach ($normal_positions as $pos) {
            if ($this->canPlaceDetail($pos['x'], $pos['y'], $detail['length'], $detail['width'], $used_spaces, $sheet)) {
                if ($this->strategy === 'best_fit') {
                    // Для best_fit выбираем позицию с минимальными отходами
                    $waste = $this->calculateWaste($pos['x'], $pos['y'], $detail['length'], $detail['width'], $sheet, $used_spaces);
                    if ($waste < $best_waste) {
                        $best_waste = $waste;
                        $best_position = [
                            'x' => $pos['x'],
                            'y' => $pos['y'],
                            'length' => $detail['length'],
                            'width' => $detail['width']
                        ];
                    }
                } else {
                    // Для других стратегий берем первую подходящую позицию
                    return [
                        'x' => $pos['x'],
                        'y' => $pos['y'],
                        'length' => $detail['length'],
                        'width' => $detail['width']
                    ];
                }
            }
        }
        
        // Если деталь имеет свободную ротацию, пытаемся развернуть
        if ($detail['rotation'] === 'free') {
            $rotated_positions = $this->getAvailablePositions(
                $detail['width'], 
                $detail['length'], 
                $pattern, 
                $used_spaces,
                $sheet
            );
            
            foreach ($rotated_positions as $pos) {
                if ($this->canPlaceDetail($pos['x'], $pos['y'], $detail['width'], $detail['length'], $used_spaces, $sheet)) {
                    if ($this->strategy === 'best_fit') {
                        $waste = $this->calculateWaste($pos['x'], $pos['y'], $detail['width'], $detail['length'], $sheet, $used_spaces);
                        if ($waste < $best_waste) {
                            $best_waste = $waste;
                            $best_position = [
                                'x' => $pos['x'],
                                'y' => $pos['y'],
                                'length' => $detail['width'],
                                'width' => $detail['length']
                            ];
                        }
                    } else {
                        return [
                            'x' => $pos['x'],
                            'y' => $pos['y'],
                            'length' => $detail['width'],
                            'width' => $detail['length']
                        ];
                    }
                }
            }
        }
        
        return $best_position;
    }
    
    /**
     * Рассчитать отходы для позиции
     */
    private function calculateWaste($x, $y, $length, $width, $sheet, $used_spaces) {
        // Простой расчет: расстояние до края листа
        $dist_right = $sheet['length'] - ($x + $length);
        $dist_bottom = $sheet['width'] - ($y + $width);
        return min($dist_right, $dist_bottom);
    }
    
    /**
     * Получить доступные позиции для размещения детали
     */
    private function getAvailablePositions($length, $width, $pattern, $used_spaces, $sheet) {
        $positions = [];
        
        // Стартовые позиции: левый верхний угол и вдоль краев существующих деталей
        $positions[] = ['x' => 0, 'y' => 0];
        
        // Позиции вдоль краев уже размещенных деталей
        foreach ($pattern['details'] as $placed_detail) {
            // Справа от детали
            $x = $placed_detail['x'] + $placed_detail['length'] + $this->margin;
            $y = $placed_detail['y'];
            if ($x + $length + $this->margin <= $sheet['length'] && 
                $y + $width + $this->margin <= $sheet['width']) {
                $positions[] = ['x' => $x, 'y' => $y];
            }
            
            // Снизу от детали
            $x = $placed_detail['x'];
            $y = $placed_detail['y'] + $placed_detail['width'] + $this->margin;
            if ($x + $length + $this->margin <= $sheet['length'] && 
                $y + $width + $this->margin <= $sheet['width']) {
                $positions[] = ['x' => $x, 'y' => $y];
            }
        }
        
        // Также проверяем сетку позиций
        for ($x = 0; $x + $length + $this->margin <= $sheet['length']; $x += 50) {
            for ($y = 0; $y + $width + $this->margin <= $sheet['width']; $y += 50) {
                $positions[] = ['x' => $x, 'y' => $y];
            }
        }
        
        return $positions;
    }
    
    /**
     * Проверить, может ли деталь быть размещена в указанной позиции
     */
    private function canPlaceDetail($x, $y, $length, $width, $used_spaces, $sheet) {
        // Проверить границы листа
        if ($x + $length + $this->margin > $sheet['length']) {
            return false;
        }
        if ($y + $width + $this->margin > $sheet['width']) {
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
