interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> {}

type DeepReadonlyObject<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

// Define DeepReadonly utility type
export type DeepReadonly<T> = T extends (infer R)[]
  ? DeepReadonlyArray<R>
  : T extends (...args: any[]) => any
    ? T
    : T extends object
      ? DeepReadonlyObject<T>
      : T;
