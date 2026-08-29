/**
 * Callback function signature for event listeners.
 *
 * Supports both synchronous and asynchronous return values.
 *
 * @typeParam Args - Tuple type defining the arguments passed to the handler.
 * @typeParam R - The expected return value type after processing.
 *
 * @param args - The arguments passed by the event dispatcher.
 * @returns A result of type `R` or a Promise resolving to `R`.
 */
export type EventHandler<Args extends unknown[], R> = (...args: Args) => R | Promise<R>;

/**
 * Manages strongly-typed event subscriptions and handles sequential event dispatching.
 *
 * Features piped event execution where each listener can transform the target payload
 * before passing it along to the next subscriber in line.
 *
 * @typeParam Args - Tuple type representing the expected event argument list.
 * @typeParam R - The return payload type that threads through listeners.
 *
 * @example
 * ```ts
 * const userEvent = new TypedEvent<[Context, User], User>();
 * 
 * const unsubscribe = userEvent.addEventListener((ctx, user) => {
 *   return { ...user, updated: true };
 * });
 * 
 * const finalUser = await userEvent.dispatch(context, initialUser);
 * ```
 */
export class TypedEvent<Args extends unknown[], R> {
    /**
     * Active listeners registered for this event.
     *
     * @internal
     */
    private listeners: Set<EventHandler<Args, R>> = new Set();

    /**
     * Registers a listener callback to handle event dispatches.
     *
     * @param handler - The callback function to execute when the event fires.
     * @returns An unsubscribe function to remove the listener.
     */
    addEventListener(handler: EventHandler<Args, R>): () => void {
        this.listeners.add(handler);
        return () => this.listeners.delete(handler);
    }

    /**
     * Removes a previously registered listener callback.
     *
     * @param handler - The exact function reference to detach.
     */
    removeEventListener(handler: EventHandler<Args, R>): void {
        this.listeners.delete(handler);
    }

    /**
     * Removes all attached listeners from this event instance.
     */
    clear(): void {
        this.listeners.clear();
    }

    /**
     * Gets the total number of active listeners subscribed to this event.
     */
    get listenerCount(): number {
        return this.listeners.size;
    }

    /**
     * Dispatches the event asynchronously, executing listeners sequentially in order.
     *
     * Performs piped parameter threading:
     * - **2 Arguments (`[Ctx, Entity]`)**: The entity (2nd arg) is piped through each listener.
     * - **3 Arguments (`[Ctx, Before, After]`)**: The `after` entity (3rd arg) is piped, while `ctx` and `before` remain static.
     * - **Generic Fallback**: The final argument is piped through each listener.
     *
     * Listener return values replace the threaded payload for subsequent handlers. If a listener returns `undefined`, the current payload value is preserved.
     *
     * @param args - Arguments matching the event signature.
     * @returns The final transformed payload object.
     */
    async dispatch(...args: Args): Promise<R> {
        if (this.listeners.size === 0) {
            // Return the threaded value (last arg for our event shapes)
            return args[args.length - 1] as unknown as R;
        }

        // Determine threading strategy based on arg count
        // 2 args: [Ctx, E] -> thread args[1]
        // 3 args: [Ctx, Before, After] -> thread args[2], keep args[0..1] fixed
        if (args.length === 2) {
            let result = args[1] as unknown as R;
            for (const fn of this.listeners) {
                const out = await (fn as unknown as (a: unknown, b: unknown) => R | Promise<R>)(args[0], result);
                if (out !== undefined) result = out as unknown as R;
            }
            return result;
        }

        if (args.length === 3) {
            let after = args[2] as unknown as R;
            const before = args[1];
            const ctx = args[0];
            for (const fn of this.listeners) {
                const out = await (fn as unknown as (c: unknown, b: unknown, a: unknown) => R | Promise<R>)(ctx, before, after);
                if (out !== undefined) after = out as unknown as R;
            }
            return after;
        }

        // Generic fallback: thread last arg
        let result = args[args.length - 1] as unknown as R;
        for (const fn of this.listeners) {
            const out = await (fn as (...a: unknown[]) => unknown)(...args.slice(0, -1), result);
            if (out !== undefined) result = out as unknown as R;
        }
        return result;
    }

    /**
     * Dispatches the event synchronously, ignoring promises returned by async handlers.
     *
     * Performs sequential value threading across synchronous handlers only. Returns returned Promises are ignored to prevent blocking execution.
     *
     * @param args - Arguments matching the event signature.
     * @returns The final transformed payload object after all sync handlers execute.
     */
    dispatchSync(...args: Args): R {
        if (this.listeners.size === 0) return args[args.length - 1] as unknown as R;
        if (args.length === 2) {
            let result = args[1] as unknown as R;
            for (const fn of this.listeners) {
                const out = (fn as (...a: unknown[]) => unknown)(args[0], result);
                if (out !== undefined && !(out instanceof Promise)) result = out as unknown as R;
            }
            return result;
        }
        if (args.length === 3) {
            let after = args[2] as unknown as R;
            for (const fn of this.listeners) {
                const out = (fn as (...a: unknown[]) => unknown)(args[0], args[1], after);
                if (out !== undefined && !(out instanceof Promise)) after = out as unknown as R;
            }
            return after;
        }
        return args[args.length - 1] as unknown as R;
    }
}