import React, { useState } from 'react';
import { useStore } from '../../store';
import { WidgetNode } from '../../types';
import { useDrag, useDrop } from 'react-dnd';

interface TreeItemProps {
    node: WidgetNode;
    depth: number;
}

const TreeItem: React.FC<TreeItemProps> = ({ node, depth }) => {
    const { selectedIds, setSelectedIds, moveWidget, removeWidget } = useStore();
    const isSelected = selectedIds.includes(node.id);
    const [isExpanded, setIsExpanded] = useState(true);

    const [{ isDragging }, dragRef] = useDrag({
        type: 'tree-item',
        item: { id: node.id },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
    });

    const [{ isOver, canDrop }, dropRef] = useDrop({
        accept: 'tree-item',
        canDrop: (item: { id: string }) => item.id !== node.id,
        drop: (item: { id: string }, monitor) => {
            if (monitor.didDrop()) return;
            // Basic reparenting to the end of the children list
            moveWidget(item.id, node.id, node.children?.length || 0);
        },
        collect: (monitor) => ({
            isOver: !!monitor.isOver({ shallow: true }),
            canDrop: !!monitor.canDrop(),
        }),
    });

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        removeWidget(node.id);
    };

    return (
        <div className="tree-item-container">
            <div
                ref={(el) => {
                    dragRef(el);
                    dropRef(el);
                }}
                className={`tree-item ${isSelected ? 'selected' : ''} ${isOver && canDrop ? 'drop-target' : ''}`}
                style={{
                    paddingLeft: `${depth * 16 + 8}px`,
                    opacity: isDragging ? 0.5 : 1,
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    if (e.shiftKey || e.ctrlKey || e.metaKey) {
                        if (isSelected) {
                            setSelectedIds(selectedIds.filter(id => id !== node.id));
                        } else {
                            setSelectedIds([...selectedIds, node.id]);
                        }
                    } else {
                        setSelectedIds([node.id]);
                    }
                }}
            >
                <span className="tree-expander" onClick={handleToggle}>
                    {node.children && node.children.length > 0 ? (
                        <i className={`mdi mdi-chevron-${isExpanded ? 'down' : 'right'}`}></i>
                    ) : (
                        <span className="tree-expander-spacer" />
                    )}
                </span>
                <span className="tree-type-icon">
                    <i className={`mdi mdi-${node.type === 'page' ? 'file-document-outline' :
                        node.type === 'button' ? 'gesture-tap-button' :
                            node.type === 'label' ? 'format-text' :
                                node.type === 'arc' ? 'progress-helper' :
                                    node.type === 'bar' ? 'poll' :
                                        node.type === 'slider' ? 'tune-variant' :
                                            node.type === 'switch' ? 'toggle-switch-outline' :
                                                'cube-outline'
                        }`}></i>
                </span>
                <span className="tree-label">{node.name || node.type}</span>
                <div className="tree-actions">
                    {node.type !== 'page' && (
                        <button className="tree-delete-btn" onClick={handleDelete} title="Delete widget">
                            <i className="mdi mdi-close"></i>
                        </button>
                    )}
                </div>
            </div>
            {isExpanded && node.children && node.children.length > 0 && (
                <div className="tree-children">
                    {node.children.map(child => (
                        <TreeItem key={child.id} node={child} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

export const WidgetTree: React.FC = () => {
    const { widgets } = useStore();

    return (
        <div className="widget-tree">
            {widgets.map(node => (
                <TreeItem key={node.id} node={node} depth={0} />
            ))}
        </div>
    );
};
