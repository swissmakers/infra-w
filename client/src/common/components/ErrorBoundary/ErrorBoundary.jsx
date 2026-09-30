import { Component, useState } from "react";
import { useRouteError } from "react-router-dom";
import Icon from "@mdi/react";
import { mdiAlertCircleOutline, mdiRefresh, mdiHome, mdiBug, mdiContentCopy, mdiCheck } from "@mdi/js";
import { useTranslation } from "react-i18next";
import { copyText } from "@/common/utils/clipboard.js";
import "./styles.sass";

const ErrorDisplay = ({ error, errorInfo, is404 = false }) => {
    // no suspense: the error page must not wait for or fail with the translation files
    const { t, ready } = useTranslation(undefined, { useSuspense: false });
    const text = key => t(`common.errorPage.${key}`);
    const [copied, setCopied] = useState(false);

    const handleRefresh = () => {
        window.location.reload();
    };

    const handleGoHome = () => {
        window.location.href = "/servers";
    };

    const handleCopyError = () => {
        const errorText = `Error: ${error?.message || "Unknown error"}\n\nStack: ${error?.stack || "No stack trace"}${errorInfo?.componentStack ? `\n\nComponent Stack: ${errorInfo.componentStack}` : ""}`;

        copyText(errorText).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }, () => {});
    };

    const errorMessage = error?.message || error?.statusText;

    if (!ready) return null;

    return (
        <div className="error-boundary">
            <div className="error-boundary-content">
                <div className="error-boundary-icon">
                    <Icon path={mdiAlertCircleOutline} />
                </div>

                <h1>{text(is404 ? "notFoundTitle" : "errorTitle")}</h1>
                <p className="error-boundary-description">
                    {text(is404 ? "notFoundText" : "errorText")}
                </p>

                {!is404 && errorMessage && (
                    <div className="error-boundary-details">
                        <div className="error-boundary-message">
                            <Icon path={mdiBug} />
                            <span>{errorMessage}</span>
                        </div>
                    </div>
                )}

                <div className="error-boundary-actions">
                    {!is404 && (
                        <button className="error-btn primary" onClick={handleRefresh}>
                            <Icon path={mdiRefresh} />
                            <span>{text("refresh")}</span>
                        </button>
                    )}
                    <button className={`error-btn ${is404 ? "primary" : "secondary"}`} onClick={handleGoHome}>
                        <Icon path={mdiHome} />
                        <span>{text("home")}</span>
                    </button>
                    {!is404 && (
                        <button className="error-btn secondary" onClick={handleCopyError}>
                            <Icon path={copied ? mdiCheck : mdiContentCopy} />
                            <span>{text(copied ? "copied" : "copyError")}</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { 
            hasError: false, 
            error: null, 
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return <ErrorDisplay error={this.state.error} errorInfo={this.state.errorInfo} />;
        }
        return this.props.children;
    }
}

const RouteErrorPage = () => {
    const error = useRouteError();
    const is404 = error?.status === 404;

    return <ErrorDisplay error={error} is404={is404} />;
};

export { ErrorBoundary, RouteErrorPage };
