import { memo } from "react";
import InfraWLogo from "@/common/components/InfraWLogo";
import "./styles.sass";

export const Loading = memo(() => {
    return (
        <div className="loading-container">
            <div className="loading-content">
                <div className="loading-logo-wrapper">
                    <InfraWLogo size={56} className="loading-logo" />
                </div>
                <div className="loading-bar"><div className="loading-bar-indicator" /></div>
            </div>
        </div>
    );
});

Loading.displayName = "Loading";
