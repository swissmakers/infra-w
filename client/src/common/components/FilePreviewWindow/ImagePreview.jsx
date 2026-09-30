import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiFitToPageOutline, mdiMagnify } from "@mdi/js";
import Button from "@/common/components/Button";
import { formatPercent } from "@/common/utils/formatUtils.js";

const ZOOM_MIN = 10;
const ZOOM_MAX = 400;
const ZOOM_STEP = 5;

export const ImagePreview = ({ src, alt }) => {
    const { t } = useTranslation();
    const viewRef = useRef(null);
    const imageRef = useRef(null);
    const pendingCenterRef = useRef(null);
    const panRef = useRef(null);
    const [natural, setNatural] = useState(null);
    const [view, setView] = useState(null);
    const [zoom, setZoom] = useState(null);
    const [panning, setPanning] = useState(false);

    useEffect(() => {
        const observer = new ResizeObserver(([entry]) => setView({ width: entry.contentRect.width, height: entry.contentRect.height }));
        observer.observe(viewRef.current);
        return () => observer.disconnect();
    }, []);

    const changeZoom = (value) => {
        const viewRect = viewRef.current.getBoundingClientRect();
        const imageRect = imageRef.current.getBoundingClientRect();
        const clamp = fraction => Math.min(1, Math.max(0, fraction));
        pendingCenterRef.current = {
            x: clamp((viewRect.left + viewRect.width / 2 - imageRect.left) / imageRect.width),
            y: clamp((viewRect.top + viewRect.height / 2 - imageRect.top) / imageRect.height),
        };
        setZoom(value);
    };

    useLayoutEffect(() => {
        const center = pendingCenterRef.current;
        const element = viewRef.current;
        if (!center || !element) return;
        pendingCenterRef.current = null;
        const viewRect = element.getBoundingClientRect();
        const imageRect = imageRef.current.getBoundingClientRect();
        element.scrollLeft += imageRect.left - viewRect.left + center.x * imageRect.width - element.clientWidth / 2;
        element.scrollTop += imageRect.top - viewRect.top + center.y * imageRect.height - element.clientHeight / 2;
    }, [zoom]);

    const startPan = (event) => {
        const element = viewRef.current;
        if (!pannable || event.pointerType === "touch" || event.button !== 0) return;
        event.preventDefault();
        element.setPointerCapture(event.pointerId);
        panRef.current = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop };
        setPanning(true);
    };
    const pan = (event) => {
        const start = panRef.current;
        if (!start) return;
        viewRef.current.scrollLeft = start.left - (event.clientX - start.x);
        viewRef.current.scrollTop = start.top - (event.clientY - start.y);
    };
    const endPan = () => {
        panRef.current = null;
        setPanning(false);
    };

    const fitted = natural && view
        ? Math.max(ZOOM_MIN, Math.min(100, Math.floor(100 * Math.min(view.width / natural.width, view.height / natural.height))))
        : 100;
    const percent = zoom ?? fitted;
    const zoomedSize = zoom && natural ? { width: natural.width * zoom / 100, height: natural.height * zoom / 100 } : undefined;
    const pannable = Boolean(zoomedSize && view && (zoomedSize.width > view.width || zoomedSize.height > view.height));

    // SVGs without an intrinsic size report a natural size of 0
    const measure = ({ currentTarget: image }) =>
        setNatural({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });

    return (
        <>
            <div ref={viewRef} className={`preview-content image-preview${zoom ? " zoomed" : ""}${pannable ? " pannable" : ""}${panning ? " panning" : ""}`}
                tabIndex={pannable ? 0 : undefined} aria-label={pannable ? alt : undefined}
                onPointerDown={startPan} onPointerMove={pan} onPointerUp={endPan} onPointerCancel={endPan}>
                <img ref={imageRef} src={src} alt={alt} style={zoomedSize} onLoad={measure} draggable={false} />
            </div>
            <div className="preview-zoom">
                <Icon path={mdiMagnify} aria-hidden="true" />
                <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={ZOOM_STEP} value={percent} disabled={!natural}
                    onChange={event => changeZoom(Number(event.target.value))}
                    aria-label={t("servers.fileManager.filePreview.zoom")} aria-valuetext={formatPercent(percent)} />
                <output>{formatPercent(percent)}</output>
                <Button icon={mdiFitToPageOutline} onClick={() => changeZoom(null)} disabled={zoom === null}
                    title={t("servers.fileManager.filePreview.fitToWindow")} aria-label={t("servers.fileManager.filePreview.fitToWindow")} />
            </div>
        </>
    );
};
