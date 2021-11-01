import React, { useEffect, useMemo } from 'react';
import makeStyles from '@mui/styles/makeStyles';
import type { FlexComponentProps } from 'reflexy';
import loadImage from '@js-toolkit/web-utils/loadImage';
import { takeSnapshot } from '@js-toolkit/web-utils/takeSnapshot';
// import blobToDataUrl from '@js-toolkit/web-utils/blobToDataUrl';
import noop from '@js-toolkit/utils/noop';
import useUpdatedRefState from '@js-toolkit/react-hooks/useUpdatedRefState';
import HideableFlex, { HideableFlexProps } from '../HideableFlex';

const useStyles = makeStyles({
  root: {
    pointerEvents: 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
  },
});

export interface PosterProps
  extends FlexComponentProps,
    Pick<
      HideableFlexProps,
      'hidden' | 'disposable' | 'onShown' | 'onHidden' | 'transitionDuration' | 'transitionFunction'
    > {
  url: string;
  crossOrigin?: 'anonymous' | 'use-credentials' | null;
  showImmediately?: boolean;
  timeout?: number;
  onLoadTimeout?: VoidFunction;
  onLoaded?: VoidFunction;
  onError?: (error: unknown) => void;
}

export default function Poster({
  hidden,
  url: urlProp,
  crossOrigin,
  showImmediately,
  timeout,
  onLoadTimeout,
  onLoaded,
  onError,
  className,
  style,
  ...rest
}: PosterProps): JSX.Element {
  const css = useStyles({ classes: { root: className } });

  const [getUrl, setUrl] = useUpdatedRefState(showImmediately ? urlProp : '', [
    showImmediately,
    urlProp,
  ]);

  const loadImagePromise = useMemo(
    () => (showImmediately ? undefined : loadImage(urlProp, crossOrigin)),
    [crossOrigin, showImmediately, urlProp]
  );
  // const loadImagePromise = useMemo(
  //   () =>
  //     // With `mode: 'no-cors'` can't access to response body so blob length will 0.
  //     window
  //       .fetch(urlProp, {
  //         method: 'GET',
  //         mode: 'cors',
  //         credentials:
  //           (crossOrigin === 'anonymous' && 'omit') ||
  //           (crossOrigin === 'use-credentials' && 'include') ||
  //           undefined,
  //         cache: 'default',
  //       })
  //       .then((res) => res.blob())
  //       .then((blob) => (blob.size > 0 ? blobToDataUrl(blob) : '')),
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  //   [urlProp]
  // );

  useEffect(() => {
    if (!loadImagePromise) return noop;
    let unmounted = false;

    const timer =
      timeout != null && timeout > 0 && onLoadTimeout ? setTimeout(onLoadTimeout, timeout) : 0;

    void loadImagePromise
      .then((img) => {
        if (unmounted) return;
        clearTimeout(timer);
        const dataUrl = takeSnapshot(img, { quality: 1 });
        setUrl(dataUrl);
      })
      .catch((ex) => !unmounted && (onError ? onError(ex) : console.error(ex)))
      .finally(() => !unmounted && onLoaded && onLoaded());

    return () => {
      unmounted = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadImagePromise]);

  const url = getUrl();

  return (
    <HideableFlex
      hidden={hidden || !url}
      transitionFunction={hidden ? 'ease-out' : 'ease-in'}
      transitionDuration="0.25s"
      className={css.root}
      style={url ? { ...style, backgroundImage: `url('${url}')` } : style}
      {...rest}
    />
  );
}
