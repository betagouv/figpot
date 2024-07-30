import diff, { Difference } from 'microdiff';

export type DiffState = 'added' | 'removed' | 'updated' | 'unchanged';

export const NUMBER_TOLERANCE: number = 0.0000000000001;

export type GetDiffResult<Model> =
  | {
      state: Extract<DiffState, 'added'>;
      after: Model;
    }
  | {
      state: Extract<DiffState, 'removed'>;
      before: Model;
    }
  | {
      state: Extract<DiffState, 'updated'>;
      before: Model;
      after: Model;
      differences: Difference[];
    }
  | {
      state: Extract<DiffState, 'unchanged'>;
      model: Model;
    };

export type GetDiffResults<ReferenceProperty, Model> = Map<ReferenceProperty, GetDiffResult<Model>>;

export function getDiff<Model extends Record<ReferenceProperty, any>, ReferenceProperty extends string | number | symbol>(
  before: Map<ReferenceProperty, Model>,
  after: Map<ReferenceProperty, Model>
): GetDiffResults<ReferenceProperty, Model> {
  const result: GetDiffResults<ReferenceProperty, Model> = new Map();

  for (const [afterModelReference, afterModel] of after) {
    const sameBeforeReferenceModel = before.get(afterModelReference);

    let itemResult: GetDiffResult<Model>;
    if (sameBeforeReferenceModel) {
      const beforeAfterModelDiff = diff(sameBeforeReferenceModel, afterModel);

      // `microdiff` won't return if unchange, so we can rely on the diff length to detect any change
      if (beforeAfterModelDiff.length > 0) {
        // [WORKAROUND] When comparing 2 objects it happens a float is different between "before" and "after"
        // This happens when reading from a file, from the API, or if the backend has done another operation that changes a bit the rounding
        // So we make sure to ignore those non-significant changes
        let w = beforeAfterModelDiff.length;
        while (w--) {
          const wDiff = beforeAfterModelDiff[w];

          if (
            wDiff.type === 'CHANGE' &&
            typeof wDiff.oldValue === 'number' &&
            typeof wDiff.value === 'number' &&
            Math.abs(wDiff.value - wDiff.oldValue) < NUMBER_TOLERANCE
          ) {
            beforeAfterModelDiff.splice(w, 1);
          }
        }

        // In case the workaround has removes changed, set the object as unchanged
        if (beforeAfterModelDiff.length === 0) {
          itemResult = {
            state: 'unchanged',
            model: afterModel,
          };
        } else {
          itemResult = {
            state: 'updated',
            before: sameBeforeReferenceModel,
            after: afterModel,
            differences: beforeAfterModelDiff,
          };
        }
      } else {
        itemResult = {
          state: 'unchanged',
          model: afterModel,
        };
      }
    } else {
      itemResult = {
        state: 'added',
        after: afterModel,
      };
    }

    result.set(afterModelReference, itemResult);
  }

  for (const [beforeModelReference, beforeModel] of before) {
    if (!after.has(beforeModelReference)) {
      result.set(beforeModelReference, {
        state: 'removed',
        before: beforeModel,
      });
    }
  }

  return result;
}

export function getDiffCounts<ReferenceProperty, Model>(result: GetDiffResults<ReferenceProperty, Model>) {
  const counts = {
    added: 0,
    removed: 0,
    updated: 0,
    unchanged: 0,
  };

  for (const [, item] of result) {
    switch (item.state) {
      case 'added':
        counts.added += 1;
        break;
      case 'removed':
        counts.removed += 1;
        break;
      case 'updated':
        counts.updated += 1;
        break;

      case 'unchanged':
        counts.unchanged += 1;
        break;
    }
  }

  return counts;
}

export function formatDiffResultLog<ReferenceProperty, Model>(result: GetDiffResults<ReferenceProperty, Model>) {
  const counts = getDiffCounts(result);

  return `added: ${counts.added} | removed: ${counts.removed} | updated: ${counts.updated} | unchanged: ${counts.unchanged}`;
}

export function removeUndefinedProperties(obj: any) {
  if (Array.isArray(obj)) {
    obj.forEach(removeUndefinedProperties);
  } else if (obj !== null && typeof obj === 'object') {
    // `null` is an object
    for (const key in obj) {
      if (obj[key] === undefined) {
        // No need to use `Object.hasOwn()` because it iterating it means it exists on the object
        delete obj[key];
      } else {
        removeUndefinedProperties(obj[key]);
      }
    }
  }
}
