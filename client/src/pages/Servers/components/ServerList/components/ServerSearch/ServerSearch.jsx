import "./styles.sass";
import Icon from "@mdi/react";
import { mdiMagnify } from "@mdi/js";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useKeymaps } from "@/common/contexts";
import { matchesKeybind } from "@/common/utils/keybinds.js";

export const ServerSearch = ({search, setSearch}) => {
    const { t } = useTranslation();
    const inputRef = useRef(null);
    const { getParsedKeybind } = useKeymaps();
    const searchKeybind = getParsedKeybind("search");

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (searchKeybind && matchesKeybind(e, searchKeybind)) {
                e.preventDefault();
                inputRef.current.focus();
            }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        }
    }, [searchKeybind]);

    return (
        <div className="server-search">
            <Icon path={mdiMagnify} className="search-icon" />
            <input className="search-input" placeholder={t("workspace.searchHosts")} aria-label={t("workspace.searchHosts")} ref={inputRef}
                value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
    )
}