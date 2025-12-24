import {
  GraphQLError,
  Kind,
  type DocumentNode,
  type FragmentDefinitionNode,
  type SelectionNode,
  type SelectionSetNode,
  type ValidationRule,
} from 'graphql';

type DocumentStats = {
  operationCount: number;
  fieldCount: number;
  depth: number;
};

function calculateDocumentStats(document: DocumentNode): DocumentStats {
  const fragments = new Map<string, FragmentDefinitionNode>();
  let operationCount = 0;

  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition);
    }
  }

  function statsOfSelectionSet(
    selectionSet: SelectionSetNode,
    currentDepth: number,
    visitedFragments: ReadonlySet<string>,
  ): { depth: number; fieldCount: number } {
    let depth = currentDepth;
    let fieldCount = 0;
    for (const selection of selectionSet.selections) {
      const stats = statsOfSelection(selection, currentDepth, visitedFragments);
      depth = Math.max(depth, stats.depth);
      fieldCount += stats.fieldCount;
    }
    return { depth, fieldCount };
  }

  function statsOfSelection(
    selection: SelectionNode,
    currentDepth: number,
    visitedFragments: ReadonlySet<string>,
  ): { depth: number; fieldCount: number } {
    switch (selection.kind) {
      case Kind.FIELD: {
        const nextDepth = currentDepth + 1;
        if (!selection.selectionSet) return { depth: nextDepth, fieldCount: 1 };
        const nested = statsOfSelectionSet(selection.selectionSet, nextDepth, visitedFragments);
        return { depth: nested.depth, fieldCount: 1 + nested.fieldCount };
      }
      case Kind.INLINE_FRAGMENT: {
        return statsOfSelectionSet(selection.selectionSet, currentDepth, visitedFragments);
      }
      case Kind.FRAGMENT_SPREAD: {
        const name = selection.name.value;
        if (visitedFragments.has(name)) return { depth: currentDepth, fieldCount: 0 };
        const fragment = fragments.get(name);
        if (!fragment) return { depth: currentDepth, fieldCount: 0 };
        const nextVisited = new Set(visitedFragments);
        nextVisited.add(name);
        return statsOfSelectionSet(fragment.selectionSet, currentDepth, nextVisited);
      }
      default:
        return { depth: currentDepth, fieldCount: 0 };
    }
  }

  let depth = 0;
  let fieldCount = 0;
  for (const definition of document.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      operationCount += 1;
      const stats = statsOfSelectionSet(definition.selectionSet, 0, new Set());
      depth = Math.max(depth, stats.depth);
      fieldCount += stats.fieldCount;
    }
  }

  return { operationCount, fieldCount, depth };
}

export function createDepthLimitRule(maxDepth: number): ValidationRule {
  return (context) => ({
    Document(node) {
      const { depth } = calculateDocumentStats(node);
      if (depth > maxDepth) {
        context.reportError(
          new GraphQLError(`Query depth ${depth} exceeds max depth ${maxDepth}.`, {
            extensions: { code: 'QUERY_TOO_DEEP', maxDepth, depth },
          }),
        );
      }
    },
  });
}

export function createFieldCountLimitRule(maxFields: number): ValidationRule {
  return (context) => ({
    Document(node) {
      const { fieldCount } = calculateDocumentStats(node);
      if (fieldCount > maxFields) {
        context.reportError(
          new GraphQLError(`Query has ${fieldCount} fields, exceeds max ${maxFields}.`, {
            extensions: { code: 'QUERY_TOO_COMPLEX', maxFields, fieldCount },
          }),
        );
      }
    },
  });
}

export function createOperationLimitRule(maxOperations: number): ValidationRule {
  return (context) => ({
    Document(node) {
      const { operationCount } = calculateDocumentStats(node);
      if (operationCount > maxOperations) {
        context.reportError(
          new GraphQLError(`Too many operations (${operationCount}), max is ${maxOperations}.`, {
            extensions: { code: 'TOO_MANY_OPERATIONS', maxOperations, operationCount },
          }),
        );
      }
    },
  });
}
