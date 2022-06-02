import { DiagramMakerNode, Position } from "diagramMaker/state/types";
import ConfigService, { ConnectorPlacementType } from 'diagramMaker/service/ConfigService';

export interface SimpleManhattanRouterProps<NodeType, EdgeType> {
    src: DiagramMakerNode<NodeType>;
    dest?: DiagramMakerNode<NodeType>;
    srcCoordinates: Position;
    destCoordinates: Position;
    padding: number;
    configService: ConfigService<NodeType, EdgeType>;
}

const SupportedConnectorTypes = [ConnectorPlacementType.TOP_BOTTOM, ConnectorPlacementType.LEFT_RIGHT];

/**
 *             ^
 *             | NEG_Y
 *             |
 *  NEG_X <----------> POS_X
 *             |
 *             | POS_Y
 *             v
 * Enum indices indicate clockwise rotation
 */
enum Direction {
    POS_X = 0,
    NEG_Y = 1,
    NEG_X = 2,
    POS_Y = 3
}

const DirectionCoordinates = {
    [Direction.POS_X]: {x: 1, y: 0},
    [Direction.NEG_X]: {x: -1, y: 0},
    [Direction.POS_Y]: {x: 0, y: 1},
    [Direction.NEG_Y]: {x: 0, y: -1},
};

const NUM_DIRECTIONS = 4;

const turnOrthoganal = (currentDir: Direction, turnClockwise: boolean): Direction => {
    // the enum values are in counter clockwise order. We loop through each directions enum appropriately
    return turnClockwise ? (currentDir + NUM_DIRECTIONS - 1) % NUM_DIRECTIONS : (currentDir + 1) % NUM_DIRECTIONS; 
}

const translatePoint = (point: Position, direction: Direction, units: number): Position => {
    const directionCoordinates = DirectionCoordinates[direction];
    return {x: point.x + directionCoordinates.x * units, 
        y: point.y + directionCoordinates.y * units };
}

const getCurrentDirection = <NodeType, EdgeType>(node: DiagramMakerNode<NodeType>, 
    configService: ConfigService<NodeType, EdgeType>): Direction => {

    const { typeId } = node;
    const connectorType = (!typeId) ? configService.getConnectorPlacement() : configService.getConnectorPlacementForNodeType(typeId);

    switch (connectorType) {
        case ConnectorPlacementType.LEFT_RIGHT:
            return Direction.POS_X;
        case ConnectorPlacementType.TOP_BOTTOM:
            return Direction.NEG_Y;
        default: 
            return Direction.POS_X;
    }
};

const addPadding = <NodeType, EdgeType>(connectorCoordinates: Position, node: DiagramMakerNode<NodeType>, 
    padding: number, configService: ConfigService<NodeType, EdgeType>): Position => {
    const { typeId } = node;
    const connectorType = (!typeId) ? configService.getConnectorPlacement() : configService.getConnectorPlacementForNodeType(typeId);

    const connectorX = connectorCoordinates.x;
    const connectorY = connectorCoordinates.y;
    const nodeX = node.diagramMakerData.position.x;
    const nodeY = node.diagramMakerData.position.y;

    let paddedX: number, paddedY: number;
    switch (connectorType) {
        case ConnectorPlacementType.LEFT_RIGHT:
            paddedY = connectorY;
            paddedX = (connectorX == nodeX) ? connectorX - padding : connectorX + padding;
            break;
        case ConnectorPlacementType.TOP_BOTTOM:
            paddedX = connectorX;
            paddedY = (connectorY == nodeY) ? connectorY - padding : connectorY + padding;
            break;
        default: 
            paddedX = nodeX;
            paddedY = nodeY;
    }

    return {x: paddedX, y: paddedY};
};

const areHorizontallyOrVerticallyCollinear = (pointOne: Position, pointTwo: Position, pointThree: Position): boolean => {
    return (pointOne.x == pointTwo.x && pointTwo.x == pointThree.x) ||  (pointOne.y == pointTwo.y && pointTwo.y == pointThree.y);
}

const getConnectorType = <NodeType, EdgeType>(configService: ConfigService<NodeType, EdgeType>, node: DiagramMakerNode<NodeType>): ConnectorPlacementType => {
    const { typeId } = node;
    return (!typeId) ? configService.getConnectorPlacement() : configService.getConnectorPlacementForNodeType(typeId);
}

const SimpleManhattan = <NodeType, EdgeType>(props: SimpleManhattanRouterProps<NodeType, EdgeType>): Position[] => {
    if (!SupportedConnectorTypes.includes(getConnectorType(props.configService, props.src) 
    || (props.dest && !SupportedConnectorTypes.includes(getConnectorType(props.configService, props.dest))))) {
        return [];
    }

    // Step 1 : Add padding to src and dest (if provided) along the normal line segment intersecting the node at the connector
    // This makes sure the starting or ending of a route is always perpendicular to the node surface and does not coincide with the node surface/interior
    const paddedSrcCoordinates = addPadding(props.srcCoordinates, props.src, props.padding, props.configService);
    let paddedDestCoordinates = props.destCoordinates;
    if (props.dest) {
        paddedDestCoordinates = addPadding(props.destCoordinates, props.dest, props.padding, props.configService)
    }

    // Step 2: Move from the padded source to the padded destination along the x and y axes. 
    // Create vertices when you move in x or y axis and add to the vertices list
    let deltaX = paddedDestCoordinates.x - paddedSrcCoordinates.x;
    let deltaY = paddedDestCoordinates.y - paddedSrcCoordinates.y;
    let currentVertex = paddedSrcCoordinates;
    let currentDirection = getCurrentDirection(props.src, props.configService);
    var vertices: Position[] = [paddedSrcCoordinates];
    while ((deltaX != 0 || deltaY != 0)) {
        let nextVertex: Position | undefined;
        let directionCoordinates = DirectionCoordinates[currentDirection];
        // Always try to move without turning if possible
        if (deltaX * directionCoordinates.x > 0) { 
            nextVertex = translatePoint(currentVertex, currentDirection, Math.abs(deltaX));
        } else if (deltaY * directionCoordinates.y > 0) {
            nextVertex = translatePoint(currentVertex, currentDirection, Math.abs(deltaY));
        } else if (directionCoordinates.y == 0) {
            // Current direction is POS_X or NEG_X. Turn to POS_Y or NEG_Y torwards the destination
            currentDirection = turnOrthoganal(currentDirection, deltaY > 0);
        } else {
            // Current direction is POS_Y or NEG_Y. Turn to POS_X or NEG_X torwards the destination
            currentDirection = turnOrthoganal(currentDirection, deltaX > 0);
        } 

        if (nextVertex && currentVertex != nextVertex) {
            currentVertex = nextVertex;
            vertices.push(currentVertex);
        }

        deltaX = paddedDestCoordinates.x - currentVertex.x;
        deltaY = paddedDestCoordinates.y - currentVertex.y;
    }

    // Step 3: Remove the last vertex for the destination node if the destination connector, the padded connector (last vertex) 
    // and the second to last vertex lie in the same line. There is no need to add an extra vertex when a line connects from the second to last vertex and the destination node
    if (paddedDestCoordinates != props.destCoordinates && vertices.length >= 2 && 
        areHorizontallyOrVerticallyCollinear(props.destCoordinates, vertices[vertices.length - 2], vertices[vertices.length - 1])) {
        vertices.pop();
    }

    return vertices;
}; 

export default SimpleManhattan;