/**
 * 异步动作 Hook
 *
 * 统一处理按钮点击的「执行中」与「失败提示」，避免每个页面重复写 try/catch。
 * 原生模块在 iOS 或未编译时会直接抛错，这里兜住并转成可读的中文提示。
 */
import {useCallback, useEffect, useRef, useState} from 'react';

export type AsyncAction = {
  /** 正在执行的动作 key，null 表示空闲 */
  busyKey: string | null;
  /** 是否有任意动作在执行 */
  busy: boolean;
  /** 最近一次失败的提示 */
  error: string | null;
  setError: (message: string | null) => void;
  /** 执行一个动作，key 用于让对应按钮单独显示 loading */
  run: (key: string, task: () => Promise<unknown> | unknown) => Promise<void>;
};

export function useAsyncAction(): AsyncAction {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(
    async (key: string, task: () => Promise<unknown> | unknown) => {
      setBusyKey(key);
      setError(null);
      try {
        await task();
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : '操作失败，请重试');
        }
      } finally {
        if (mountedRef.current) {
          setBusyKey(null);
        }
      }
    },
    [],
  );

  return {busyKey, busy: busyKey !== null, error, setError, run};
}
