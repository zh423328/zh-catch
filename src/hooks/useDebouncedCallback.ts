/**
 * 防抖回调 Hook
 *
 * 参数面板里拖动滑块、连续点步进会产生大量变更，
 * 用固定延迟合并成一次提交，避免高频调用原生 configure。
 */
import {useCallback, useEffect, useMemo, useRef} from 'react';

export type DebouncedCallback<A extends unknown[]> = {
  /** 触发一次（延迟执行；期间的新调用会覆盖旧参数） */
  call: (...args: A) => void;
  /** 立即执行挂起的那次调用 */
  flush: () => void;
  /** 丢弃挂起的调用 */
  cancel: () => void;
};

export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delayMs: number,
): DebouncedCallback<A> {
  // 用 ref 持有最新回调，避免回调变化导致定时器被重置
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<A | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const args = pendingRef.current;
    pendingRef.current = null;
    if (args) {
      fnRef.current(...args);
    }
  }, []);

  const call = useCallback(
    (...args: A) => {
      pendingRef.current = args;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const latest = pendingRef.current;
        pendingRef.current = null;
        if (latest) {
          fnRef.current(...latest);
        }
      }, delayMs);
    },
    [delayMs],
  );

  // 返回稳定引用，调用方可以安全地把它写进依赖数组
  const api = useMemo<DebouncedCallback<A>>(
    () => ({call, flush, cancel}),
    [call, flush, cancel],
  );

  // 卸载时清理定时器，避免泄漏
  useEffect(() => cancel, [cancel]);

  return api;
}
