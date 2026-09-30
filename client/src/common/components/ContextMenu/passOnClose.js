import React from "react";

export const passOnClose = (children, onClose) => React.Children.map(children, (child) => {
    if (!React.isValidElement(child) || typeof child.type === "string") return child;
    if (child.type === React.Fragment) return React.cloneElement(child, {}, passOnClose(child.props.children, onClose));
    return React.cloneElement(child, { onClose });
});
