import React, { useLayoutEffect } from 'react';
import type { Property } from 'csstype';
import makeStyles from '@material-ui/styles/makeStyles';
import { Flex, DefaultComponentType, FlexAllProps } from 'reflexy';
import useRefCallback from '@js-toolkit/react-hooks/useRefCallback';
import useUpdatedRefState from '@js-toolkit/react-hooks/useUpdatedRefState';

export interface Transition {
  readonly duration?: Property.TransitionDuration<number>;
  readonly func?: Property.TransitionTimingFunction;
  readonly property?: Property.TransitionProperty;
}

export interface HideableProps {
  readonly transitionDuration?: Transition['duration'];
  readonly transitionFunction?: Transition['func'];
  readonly transitionProperty?: Transition['property'];
  readonly transition?: Transition;

  readonly hidden?: boolean;
  readonly disposable?: boolean;
  readonly collapsable?: boolean;
  readonly keepChildren?: boolean;
  readonly appear?: boolean;
  readonly hiddenClassName?: string;
  readonly onHidden?: VoidFunction;
  readonly onShown?: VoidFunction;
}

export type HideableFlexProps<C extends React.ElementType = DefaultComponentType> = FlexAllProps<
  C,
  { defaultStyles: { className: true } }
> &
  HideableProps;

interface State {
  readonly hidden: boolean;
  readonly disposed: boolean;
  readonly lastChildren: React.ReactNode;
}

type MakeStylesProps = Pick<HideableFlexProps, 'hidden' | 'collapsable'> &
  RequiredBut<Transition, 'property'>;

export function getTransition({
  hidden,
  collapsable,
  duration,
  func,
  property: prop,
}: MakeStylesProps): string {
  const dur = typeof duration === 'number' ? `${duration}ms` : duration;
  const transition = hidden ? `visibility 0s ${func} ${dur}` : `visibility 0s ${func} 0s`;
  const restProperties = `opacity${collapsable ? ',max-height' : ''}${prop ? `,${prop}` : ''}`;

  return restProperties
    .split(',')
    .reduce((acc, tprop) => `${acc},${tprop} ${dur} ${func}`, transition);
}

const useStyles = makeStyles({
  root: (props: MakeStylesProps) => {
    const transition = getTransition(props);
    if (props.hidden) {
      return {
        pointerEvents: 'none',
        visibility: 'hidden',
        opacity: 0,
        maxHeight: props.collapsable ? 0 : undefined,
        transition,
      };
    }
    return {
      visibility: 'visible',
      opacity: 1,
      maxHeight: props.collapsable ? '100vh' : undefined,
      transition,
    };
  },
});

export default function HideableFlex<C extends React.ElementType = DefaultComponentType>({
  hidden: hiddenProp,
  disposable,
  collapsable,
  keepChildren,
  appear = true,
  className,
  hiddenClassName,
  transitionDuration = '0.2s',
  transitionFunction = 'ease',
  transitionProperty,
  transition: {
    duration = transitionDuration,
    func = transitionFunction,
    property = transitionProperty,
  } = {},
  onHidden,
  onShown,
  ...rest
}: HideableFlexProps<C>): JSX.Element | null {
  const { onTransitionEnd, children: childrenProp } = rest as React.HTMLAttributes<Element>;

  const [getState, setState] = useUpdatedRefState<State>(
    (prev) => {
      // Initial state
      if (!prev) {
        return {
          hidden: appear ? true : !!hiddenProp,
          disposed: disposable ? !!hiddenProp || appear : false,
          lastChildren: childrenProp,
        };
      }
      // Sync state with prop
      return {
        ...prev,
        hidden: !!hiddenProp,
        // Restore if not hidden
        disposed: disposable && !hiddenProp ? false : prev.disposed,
      };
    },
    [disposable, hiddenProp]
  );

  // Immediatly show after first render to activate transition
  useLayoutEffect(() => {
    if (appear && !hiddenProp) {
      setState((prev) => ({ ...prev, hidden: false, disposed: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transitionEndHandler = useRefCallback<React.TransitionEventHandler>((event) => {
    onTransitionEnd && onTransitionEnd(event);

    // Ignore bubbling events from children elements
    if (event.target !== event.currentTarget) return;
    // Listen only `opacity` changes.
    if (event.propertyName !== 'opacity') return;

    const { hidden, disposed } = getState();
    if (hidden) {
      if ((disposable && !disposed) || keepChildren) {
        setState((prev) => ({
          ...prev,
          // Dispose after animation ends. It will be reverted by state sync.
          disposed: disposable ? true : prev.disposed,
          lastChildren: undefined,
        }));
      }
      onHidden && onHidden();
    } else {
      keepChildren && setState((prev) => ({ ...prev, lastChildren: childrenProp }));
      onShown && onShown();
    }
  });

  const { hidden, disposed, lastChildren } = getState();
  const children = keepChildren ? childrenProp || lastChildren : childrenProp;

  const css = useStyles({
    classes: { root: className },
    hidden: disposable ? hidden || disposed : hidden,
    collapsable: !!collapsable,
    duration,
    func,
    property,
  });

  if (hidden && disposable && disposed) return null;

  return (
    <Flex
      className={hidden && hiddenClassName ? `${css.root} ${hiddenClassName}` : css.root}
      {...rest}
      onTransitionEnd={transitionEndHandler}
      // eslint-disable-next-line react/no-children-prop
      children={children}
    />
  );
}
