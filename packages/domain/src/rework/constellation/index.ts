// @racer/domain/rework/constellation: the re-authored constellation trees (docs/rework/05-training-hub.md §4).
export { fairShare, perCardCap, TREE_CARD_NODES, treeCardNodes, treeCardNodesAt } from './sizes'
export { TREE_ART, TREE_MOTIFS, TREE_SHAPES, treeShape } from './shapes'
export {
  buildTree,
  cardNodeId,
  DRAWN_TREES,
  nodeOrder,
  ROOT_ID,
  treeEdges,
  treeFor,
  type Tree,
  type TreeEdge,
  type TreeNode,
  type TreeNodeKind,
} from './tree'
export {
  MIN_NODE_SPACING_PT,
  PHONE_GRAPH_BOX_PT,
  spacingPt,
  validateAllTrees,
  validateTree,
  type TreeIssue,
  type TreeIssueCode,
} from './validate'
