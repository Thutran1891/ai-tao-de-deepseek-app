import React, { useMemo } from 'react';
import { GeometryGraph } from '../types';

interface Props { graph: GeometryGraph; }

export const DynamicGeometry: React.FC<Props> = ({ graph }) => {
    const SCALE_FACTOR = 50; // Giảm scale một chút để hình đỡ bị to quá khổ
    // 1. [CHÈN THÊM ĐOẠN NÀY] 
    // Logic: Kiểm tra xem tất cả các điểm có Z = 0 không
    // -----------------------------------------------------------
    const is2DMode = useMemo(() => {
        if (!graph.nodes || graph.nodes.length === 0) return false;
        // Nếu tất cả tọa độ z đều xấp xỉ 0 (hoặc không tồn tại), thì là 2D
        return graph.nodes.every(node => Math.abs(node.z || 0) < 0.01);
    }, [graph]);

    // --- PHÉP CHIẾU TRỤC ĐO (Góc nhìn SGK) ---
    // Input: Tọa độ 3D (x, y, z)
    // Output: Tọa độ 2D (sx, sy) trên màn hình SVG
// 2. [THAY THẾ HOÀN TOÀN HÀM PROJECT CŨ BẰNG ĐOẠN NÀY]
    // -----------------------------------------------------------
    const project = (x: number, y: number, z: number) => {
        // CASE 1: NẾU LÀ 2D -> VẼ PHẲNG (Orthographic)
        if (is2DMode) {
            return {
                x: x * SCALE_FACTOR,       // X giữ nguyên
                y: -y * SCALE_FACTOR       // Y đảo dấu (vì SVG trục Y hướng xuống)
            };
        }

        // CASE 2: NẾU LÀ 3D -> DÙNG PHÉP CHIẾU TRỤC ĐO (Giữ nguyên logic cũ của bạn)
        const angle = Math.PI / 6; 
        const depthScale = 0.5;    

        const sx = (y - x * depthScale * Math.cos(angle)) * SCALE_FACTOR;
        const sy = (-z + x * depthScale * Math.sin(angle)) * SCALE_FACTOR;

        return { x: sx, y: sy };
    };
    const { projectedNodes, viewBox } = useMemo(() => {
        if (!graph.nodes || graph.nodes.length === 0) return { projectedNodes: {}, viewBox: "0 0 300 300" };
        
        const proj: Record<string, {x: number, y: number}> = {};
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        // 1. Tính toán tọa độ 2D cho tất cả các điểm
        graph.nodes.forEach(node => {
            const p = project(node.x, node.y, node.z);
            proj[node.id] = p;
            
            // Tìm giới hạn khung hình để crop (ViewBox)
            minX = Math.min(minX, p.x); 
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); 
            maxY = Math.max(maxY, p.y);
        });

        // Thêm lề (padding) để không bị cắt chữ
        const padding = 60; 
        return { 
            projectedNodes: proj, 
            viewBox: `${minX - padding} ${minY - padding} ${maxX - minX + padding*2} ${maxY - minY + padding*2}` 
        };
    }, [graph]);

    // Hàm tính vị trí nhãn (A, B, C...) để không đè lên hình
    const getLabelOffset = (pos?: string) => {
        const d = 20; 
        switch(pos) {
            case 'TOP': return {x: 0, y: -d};
            case 'BOTTOM': return {x: 0, y: d + 5};
            case 'LEFT': return {x: -d - 5, y: 0};
            case 'RIGHT': return {x: d + 5, y: 0};
            case 'TOP_LEFT': return {x: -d, y: -d};
            case 'TOP_RIGHT': return {x: d, y: -d};
            case 'BOTTOM_LEFT': return {x: -d, y: d};
            case 'BOTTOM_RIGHT': return {x: d, y: d};
            default: return {x: 10, y: -10}; // Mặc định góc trên phải
        }
    };

    return (
        <svg viewBox={viewBox} className="w-full h-full select-none" style={{maxHeight: '400px'}}>
            {/* Vẽ CẠNH (Edges) trước */}
            {graph.edges.map((edge, i) => {
                const p1 = projectedNodes[edge.from];
                const p2 = projectedNodes[edge.to];
                if (!p1 || !p2) return null;
                return (
                    <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                        stroke="black" strokeWidth="1.5"
                        strokeDasharray={edge.style === 'DASHED' ? "5,5" : ""}
                        strokeLinecap="round"
                    />
                );
            })}

            {/* Vẽ ĐỈNH (Nodes) và NHÃN sau */}
            {graph.nodes.map((node) => {
                const p = projectedNodes[node.id];
                if (!p) return null;
                const offset = getLabelOffset(node.labelPosition);
                return (
                    <g key={node.id}>
                        {/* Chấm tròn tại đỉnh */}
                        <circle cx={p.x} cy={p.y} r="3.5" fill="black" />
                        
                        {/* Tên đỉnh */}
                        <text 
                            x={p.x + offset.x} 
                            y={p.y + offset.y} 
                            fontFamily="Times New Roman, serif" 
                            fontSize="18" 
                            fontWeight="bold" 
                            fontStyle="italic"
                            textAnchor="middle" 
                            dominantBaseline="middle"
                        >
                            {node.id}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
};