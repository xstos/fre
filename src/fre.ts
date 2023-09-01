
/* export */
type Key = FreText

/* export */
interface RefObject<T> {
  current: T
}

/* export */
type RefCallback<T> = {
  bivarianceHack(instance: T | null): void
}['bivarianceHack']
/* export */
type Ref<T = any> = RefCallback<T> | RefObject<T> | null

/* export */
interface Attributes extends Record<string, any> {
  key?: Key
  children?: FreNode
  ref?: Ref
}

/* export */
interface FC<P extends Attributes = {}> {
  fiber?: IFiber
  type?: string
  memo?: boolean
  shouldUpdate?: (newProps: P, oldProps: P) => boolean

  (props: P): FreElement<P> | null
}

/* export */
interface FreElement<P extends Attributes = any, T = string> {
  type: T
  props: P
  key: string
}

/* export */
type HookTypes = 'list' | 'effect' | 'layout'

/* export */
interface IHook {
  list: IEffect[]
  layout: IEffect[]
  effect: IEffect[]
}

/* export */
type IRef = (
  e: HTMLElement | undefined,
) => void | { current?: HTMLElement }

/* export */
interface IFiber<P extends Attributes = any> {
  key?: string
  type: string | FC<P>
  parentNode: HTMLElementEx
  node: HTMLElementEx
  kids?: any
  dirty: boolean,
  parent?: IFiber<P>
  sibling?: IFiber<P>
  child?: IFiber<P>
  done?: () => void
  ref: IRef
  hooks: IHook
  oldProps: P
  action: any
  props: P
  lane: number
  isComp: boolean
}

/* export */
type HTMLElementEx = HTMLElement & { last: IFiber | null }
/* export */
type IEffect = [Function?, number?, Function?]
/* export */
type FreText = string | number
/* export */
type FreNode =
  | FreText
  | FreElement
  | FreNode[]
  | boolean
  | null
  | undefined
/* export */
type SetStateAction<S> = S | ((prevState: S) => S)
/* export */
type Dispatch<A> = (value: A, resume?: boolean) => void
/* export */
type Reducer<S, A> = (prevState: S, action: A) => S
/* export */
type IVoidCb = () => void
/* export */
type EffectCallback = () => void | (IVoidCb | undefined)
/* export */
type DependencyList = Array<any>

/* export */
interface PropsWithChildren {
  children?: FreNode
}

/* export */
type ITaskCallback = ((time: boolean) => boolean) | null

/* export */
interface ITask {
  callback?: ITaskCallback
  fiber: IFiber
}

/* export */
type DOM = HTMLElement | SVGElement
type ContextType<T> = {
  ({value, children}: { value: T, children: FreNode }): FreNode;
  initialValue: T;
}
type SubscriberCb = () => void;

function freModule() {
  const defaultObj = {} as const
  function jointIter<P extends Attributes>(
    aProps: P,
    bProps: P,
    callback: (name: string, a: any, b: any) => void,
  ) {
    aProps = aProps || defaultObj as P
    bProps = bProps || defaultObj as P
    Object.keys(aProps).forEach(k => callback(k, aProps[k], bProps[k]))
    Object.keys(bProps).forEach(k => !aProps.hasOwnProperty(k) && callback(k, undefined, bProps[k]))
  }
  let currentFiber: IFiber = null
  let rootFiber = null

  /* export */
  const enum TAG {
    UPDATE = 1 << 1,
    INSERT = 1 << 2,
    REMOVE = 1 << 3,
    SVG = 1 << 4,
    DIRTY = 1 << 5,
    MOVE = 1 << 6,
    REPLACE = 1 << 7
  }

  /* export */
  function render(vnode: FreElement, node: Node): void {
    rootFiber = {
      node,
      props: {children: vnode},
    } as IFiber
    update(rootFiber)
  }
  const queue: ITask[] = []
  const threshold: number = 5
  const transitions = []
  let deadline: number = 0

  /* export */
  function startTransition(cb) {
    transitions.push(cb) && translate()
  }

  /* export */
  function schedule(callback: any): void {
    queue.push({callback} as any)
    startTransition(flush)
  }
  function task(pending: boolean) {
    const cb = () => transitions.splice(0, 1).forEach(c => c())
    if (!pending && typeof queueMicrotask !== 'undefined') {
      return () => queueMicrotask(cb)
    }
    if (typeof MessageChannel !== 'undefined') {
      const {port1, port2} = new MessageChannel()
      port1.onmessage = cb
      return () => port2.postMessage(null)
    }
    return () => setTimeout(cb)
  }
  let translate = task(false)
  function flush(): void {
    deadline = getTime() + threshold
    let job = peek(queue)
    while (job && !shouldYield()) {
      const {callback} = job as any
      job.callback = null
      const next = callback()
      if (next) {
        job.callback = next as any
      } else {
        queue.shift()
      }
      job = peek(queue)
    }
    job && (translate = task(shouldYield())) && startTransition(flush)
  }

  /* export */
  function shouldYield(): boolean {
    return getTime() >= deadline
  }

  /* export */
  function getTime() {
    return performance.now()
  }
  function peek(queue: ITask[]) {
    return queue[0]
  }

  /* export */
  function update(fiber?: IFiber) {
    if (!fiber.dirty) {
      fiber.dirty = true
      schedule(() => reconcile(fiber))
    }
  }
  function reconcile(fiber?: IFiber): boolean {
    while (fiber && !shouldYield()) fiber = capture(fiber)
    if (fiber) return reconcile.bind(null, fiber)
    return null
  }
  function memo2(fiber) {
    if ((fiber.type as FC).memo && fiber.old?.props) {
      let scu = (fiber.type as FC).shouldUpdate || shouldUpdate
      if (!scu(fiber.props, fiber.old.props)) { // fast-fix
        return getSibling(fiber)
      }
    }
    return null
  }
  function capture(fiber: IFiber): IFiber | undefined {
    fiber.isComp = isFn(fiber.type)
    if (fiber.isComp) {
      const memoFiber = memo2(fiber)
      if (memoFiber) {
        return memoFiber
      }
      updateHook(fiber)
    } else {
      updateHost(fiber)
    }
    if (fiber.child) return fiber.child
    const sibling = getSibling(fiber)
    return sibling
  }
  function getSibling(fiber) {
    while (fiber) {
      bubble(fiber)
      if (fiber.dirty) {
        fiber.dirty = false
        commit(fiber)
        return null
      }
      if (fiber.sibling) return fiber.sibling
      fiber = fiber.parent
    }
    return null
  }
  function bubble(fiber) {
    if (fiber.isComp) {
      if (fiber.hooks) {
        side(fiber.hooks.layout)
        schedule(() => side(fiber.hooks.effect))
      }
    }
  }
  function shouldUpdate(a, b) {
    for (let i in a) if (!(i in b)) return true
    for (let i in b) if (a[i] !== b[i]) return true
  }
  function updateHook<P = Attributes>(fiber: IFiber): any {
    resetCursor()
    currentFiber = fiber
    let children = (fiber.type as FC<P>)(fiber.props)
    reconcileChidren(fiber, simpleVnode(children))
  }
  function updateHost(fiber: IFiber): void {
    fiber.parentNode = (getParentNode(fiber) as any) || {}
    if (!fiber.node) {
      if (fiber.type === 'svg') fiber.lane |= TAG.SVG
      fiber.node = createElement(fiber) as HTMLElementEx
    }
    reconcileChidren(fiber, fiber.props.children)
  }
  function simpleVnode(type: any) {
    return isStr(type) ? createText(type as string) : type
  }
  function getParentNode(fiber: IFiber): HTMLElement | undefined {
    while ((fiber = fiber.parent)) {
      if (!fiber.isComp) return fiber.node
    }
  }
  function reconcileChidren(fiber: any, children: FreNode): void {
    let aCh = fiber.kids || [],
      bCh = (fiber.kids = arrayfy(children) as any)
    const actions = diff(aCh, bCh)

    for (let i = 0, prev = null, len = bCh.length; i < len; i++) {
      const child = bCh[i]
      child.action = actions[i]
      if (fiber.lane & TAG.SVG) {
        child.lane |= TAG.SVG
      }
      child.parent = fiber
      if (i > 0) {
        prev.sibling = child
      } else {
        fiber.child = child
      }
      prev = child
    }
  }
  function clone(a, b) {
    b.hooks = a.hooks
    b.ref = a.ref
    b.node = a.node // 临时修复
    b.kids = a.kids
    b.old = a
  }

  /* export */
  function arrayfy(arr) {
    return !arr ? [] : isArr(arr) ? arr : [arr]
  }
  function side(effects: IEffect[]): void {
    effects.forEach(e => e[2] && e[2]())
    effects.forEach(e => (e[2] = e[0]()))
    effects.length = 0
  }
  function diff(a, b) {
    var actions = [],
      aIdx = {},
      bIdx = {},
      key = v => v.key + v.type,
      i, j;
    for (i = 0; i < a.length; i++) {
      aIdx[key(a[i])] = i;
    }
    for (i = 0; i < b.length; i++) {
      bIdx[key(b[i])] = i;
    }
    for (i = j = 0; i !== a.length || j !== b.length;) {
      var aElm = a[i], bElm = b[j];
      if (aElm === null) {
        i++;
      } else if (b.length <= j) {
        removeElement(a[i])
        i++;
      } else if (a.length <= i) {
        actions.push({op: TAG.INSERT, elm: bElm, before: a[i]})
        j++;
      } else if (key(aElm) === key(bElm)) {
        clone(aElm, bElm)
        actions.push({op: TAG.UPDATE})
        i++;
        j++;
      } else {
        var curElmInNew = bIdx[key(aElm)]
        var wantedElmInOld = aIdx[key(bElm)]
        if (curElmInNew === undefined) {
          removeElement(a[i])
          i++;
        } else if (wantedElmInOld === undefined) {
          actions.push({op: TAG.INSERT, elm: bElm, before: a[i]})
          j++
        } else {
          clone(a[wantedElmInOld], bElm)
          actions.push({op: TAG.MOVE, elm: a[wantedElmInOld], before: a[i]})
          a[wantedElmInOld] = null
          j++
        }
      }
    }
    return actions
  }

  /* export */
  function getCurrentFiber() {
    return currentFiber || null
  }

  /* export */
  function isFn(x: any): x is Function {
    return typeof x === 'function'
  }

  /* export */
  function isStr(s: any): s is number | string {
    return typeof s === 'number' || typeof s === 'string'
  }

  /* export */
  function updateElement<P extends Attributes>(
    dom: DOM,
    aProps: P,
    bProps: P,
  ) {
    jointIter(aProps, bProps, (name, a, b) => {
      if (a === b || name === 'children') {
      } else if (name === 'style' && !isStr(b)) {
        jointIter(a, b, (styleKey, aStyle, bStyle) => {
          if (aStyle !== bStyle) {
            ;(dom as any)[name][styleKey] = bStyle || ''
          }
        })
      } else if (name[0] === 'o' && name[1] === 'n') {
        name = name.slice(2).toLowerCase() as Extract<keyof P, string>
        if (a) dom.removeEventListener(name, a)
        dom.addEventListener(name, b)
      } else if (name in dom && !(dom instanceof SVGElement)) {
        ;(dom as any)[name] = b || ''
      } else if (b == null || b === false) {
        dom.removeAttribute(name)
      } else {
        dom.setAttribute(name, b)
      }
    })
  }

  /* export */
  function createElement<P = Attributes>(fiber: IFiber) {
    const dom =
      fiber.type === '#text'
        ? document.createTextNode('')
        : fiber.lane & TAG.SVG
          ? document.createElementNS(
            'http://www.w3.org/2000/svg',
            fiber.type as string,
          )
          : document.createElement(fiber.type as string)
    updateElement(dom as DOM, {} as P, fiber.props as P)
    return dom
  }

  /* export */
  function commit(fiber: any) {
    if (!fiber) {
      return
    }
    const {op, before, elm} = fiber.action || {}
    if (op & TAG.INSERT || op & TAG.MOVE) {
      if (fiber.isComp && fiber.child) {
        fiber.child.action.op |= fiber.action.op
      } else {
        fiber.parentNode.insertBefore(elm.node, before?.node)
      }
    }
    if (op & TAG.UPDATE) {
      if (fiber.isComp && fiber.child) {
        fiber.child.action.op |= fiber.action.op
      } else {
        updateElement(fiber.node, fiber.old.props || {}, fiber.props)
      }
    }

    refer(fiber.ref, fiber.node)

    fiber.action = null

    commit(fiber.child)
    commit(fiber.sibling)
  }
  function refer(ref: IRef, dom?: HTMLElement): void {
    if (ref)
      isFn(ref) ? ref(dom) : ((ref as { current?: HTMLElement })!.current = dom)
  }
  function kidsRefer(kids: any): void {
    kids.forEach(kid => {
      kid.kids && kidsRefer(kid.kids)
      refer(kid.ref, null)
    })
  }

  /* export */
  function removeElement(fiber) {
    if (fiber.isComp) {
      fiber.hooks && fiber.hooks.list.forEach(e => e[2] && e[2]())
      fiber.kids.forEach(removeElement)
    } else {
      fiber.parentNode.removeChild(fiber.node)
      kidsRefer(fiber.kids)
      refer(fiber.ref, null)
    }
  } // for jsx2

  /* export */
  function h(type, props: any, ...kids) {
    props = props || {}
    kids = flat(arrayfy(props.children || kids))

    if (kids.length) props.children = kids.length === 1 ? kids[0] : kids

    const key = props.key || null
    const ref = props.ref || null

    if (key) props.key = undefined
    if (ref) props.ref = undefined

    return createVnode(type, props, key, ref)
  }
  function some(x: unknown) {
    return x != null && x !== true && x !== false
  }
  function flat(arr: any[], target = []) {
    arr.forEach(v => {
      isArr(v)
        ? flat(v, target)
        : some(v) && target.push(isStr(v) ? createText(v) : v)
    })
    return target
  }

  /* export */
  function createVnode(type, props, key, ref) {
    return {
      type,
      props,
      key,
      ref,
    }
  }

  /* export */
  function createText(vnode: any) {
    return {type: '#text', props: {nodeValue: vnode + ''}} as FreElement
  }
  /* export */
  function Fragment(props) {
    return props.children
  }
  /* export */
  function memo<T extends object>(fn: FC<T>, compare?: FC<T>['shouldUpdate']) {
    fn.memo = true
    fn.shouldUpdate = compare
    return fn
  }
  /* export */
  const isArr = Array.isArray
  const EMPTY_ARR = []
  let cursor = 0

  /* export */
  function resetCursor() {
    cursor = 0
  }

  /* export */
  function useState<T>(initState: T): [T, Dispatch<SetStateAction<T>>] {
    return useReducer(null, initState)
  }

  /* export */
  function useReducer<S, A>(
    reducer?: Reducer<S, A>,
    initState?: S,
  ): [S, Dispatch<A>] {
    const [hook, current]: [any, IFiber] = getHook<S>(cursor++)
    if (hook.length === 0) {
      hook[0] = initState
      hook[1] = (value: A | Dispatch<A>) => {
        let v = reducer
          ? reducer(hook[0], value as any)
          : isFn(value)
            ? value(hook[0])
            : value
        if (hook[0] !== v) {
          hook[0] = v
          update(current)
        }
      }
    }
    return hook
  }

  /* export */
  function useEffect(cb: EffectCallback, deps?: DependencyList): void {
    return effectImpl(cb, deps!, "effect")
  }

  /* export */
  function useLayout(cb: EffectCallback, deps?: DependencyList): void {
    return effectImpl(cb, deps!, "layout")
  }
  function effectImpl(
    cb: EffectCallback,
    deps: DependencyList,
    key: HookTypes,
  ): void {
    const [hook, current] = getHook(cursor++)
    if (isChanged(hook[1], deps)) {
      hook[0] = cb
      hook[1] = deps
      current.hooks[key].push(hook)
    }
  }

  /* export */
  function useMemo<S = Function>(
    cb: () => S,
    deps?: DependencyList,
  ): S {
    const hook = getHook<S>(cursor++)[0]
    if (isChanged(hook[1], deps!)) {
      hook[1] = deps
      return (hook[0] = cb())
    }
    return hook[0]
  }

  /* export */
  function useCallback<T extends (...args: any[]) => void>(
    cb: T,
    deps?: DependencyList,
  ): T {
    return useMemo(() => cb, deps)
  }

  /* export */
  function useRef<T>(current: T): RefObject<T> {
    return useMemo(() => ({current}), [])
  }

  /* export */
  function getHook<S = Function | undefined, Dependency = any>(
    cursor: number,
  ): [[S, Dependency], IFiber] {
    const current: IFiber<any> = getCurrentFiber()
    const hooks =
      current.hooks || (current.hooks = {list: [], effect: [], layout: []})
    if (cursor >= hooks.list.length) {
      hooks.list.push([] as IEffect)
    }
    return [(hooks.list[cursor] as unknown) as [S, Dependency], current]
  }
  /* export */


  /* export */
  function createContext<T>(initialValue: T): ContextType<T> {
    function contextComponent({value, children}) {
      const valueRef = useRef(value)
      const subscribers = useMemo(() => new Set<SubscriberCb>(), EMPTY_ARR)

      if (valueRef.current !== value) {
        valueRef.current = value;
        subscribers.forEach((subscriber) => subscriber())
      }

      return children
    }
    contextComponent.initialValue = initialValue;
    return contextComponent;
  }

  /* export */
  function useContext<T>(contextType: ContextType<T>): T {
    let subscribersSet: Set<Function>

    const triggerUpdate = useReducer(null, null)[1] as SubscriberCb

    useEffect(() => {
      return () => subscribersSet && subscribersSet.delete(triggerUpdate)
    }, EMPTY_ARR);

    let contextFiber = getCurrentFiber().parent
    while (contextFiber && contextFiber.type !== contextType) {
      contextFiber = contextFiber.parent
    }

    if (contextFiber) {
      const hooks = contextFiber.hooks.list as unknown as [[RefObject<T>], [Set<SubscriberCb>]]
      const [[value], [subscribers]] = hooks;

      subscribersSet = subscribers.add(triggerUpdate)

      return value.current
    } else {
      return contextType.initialValue
    }
  }

  /* export */
  function isChanged(a: DependencyList, b: DependencyList) {
    return !a || a.length !== b.length || b.some((arg, index) => !Object.is(arg, a[index]))
  }

}
