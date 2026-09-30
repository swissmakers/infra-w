import { useContext, useMemo } from "react";
import SelectBox from "@/common/components/SelectBox";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import Icon from "@mdi/react";
import { mdiServerNetwork, mdiClose, mdiPlus, mdiMonitor, mdiPalette, mdiVolumeHigh, mdiPowerPlug, mdiKeyboardOutline, mdiCertificateOutline } from "@mdi/js";
import IconInput from "@/common/components/IconInput";
import { useTranslation } from "react-i18next";
import { ServerContext } from "@/common/contexts";

const COLOR_DEPTHS = ["", "8", "16", "24", "32"];

const RESIZE_METHODS = ["display-update", "reconnect", "none"];

const BACKSPACE_MODES = [
    { label: "DEL", value: "del" },
    { label: "^H", value: "ctrl-h" },
];

const DELETE_MODES = [
    { label: "VT", value: "vt" },
    { label: "DEL", value: "del" },
];

const FUNCTION_KEY_MODES = [
    { label: "Xterm", value: "xterm" },
    { label: "VT", value: "vt" },
    { label: "Linux", value: "linux" },
];

// layout ids as defined by Guacamole
const KEYBOARD_LAYOUTS = ["cs-cz-qwertz", "da-dk-qwerty", "de-ch-qwertz", "de-de-qwertz", "en-gb-qwerty", "en-us-qwerty",
    "es-es-qwerty", "es-latam-qwerty", "failsafe", "fr-be-azerty", "fr-ch-qwertz", "fr-fr-azerty", "hu-hu-qwertz",
    "it-it-qwerty", "ja-jp-qwerty", "pt-br-qwerty", "sv-se-qwerty", "tr-tr-qwerty"];

const keyboardLayoutLabel = (value, language) => {
    if (value === "failsafe") return "Unicode";
    const [lang, region, layout] = value.split("-");
    const locale = `${lang}-${region === "latam" ? "419" : region.toUpperCase()}`;
    return `${new Intl.DisplayNames([language], { type: "language", languageDisplay: "standard" }).of(locale)} (${layout.toUpperCase()})`;
};

const SettingsPage = ({ config, setConfig, fieldConfig, editServerId }) => {
    const { t, i18n } = useTranslation();
    const { servers } = useContext(ServerContext);
    const keyboardLayoutOptions = KEYBOARD_LAYOUTS.map(value => ({ value, label: keyboardLayoutLabel(value, i18n.language) }))
        .sort((a, b) => a.label.localeCompare(b.label, i18n.language));
    const colorDepthOptions = COLOR_DEPTHS.map(value => ({ value, label: t(`servers.dialog.settings.display.colorDepths.${value || "auto"}`) }));
    const resizeMethodOptions = RESIZE_METHODS.map(value => ({ value, label: t(`servers.dialog.settings.display.resizeMethods.${value}`) }));
    const getSetting = (key, fallback) => (config?.[key] !== undefined ? config[key] : fallback);
    const keyboardLayout = config?.keyboardLayout || "en-us-qwerty";
    const jumpHosts = config?.jumpHosts || [];

    const colorDepth = getSetting("colorDepth", "");
    const resizeMethod = getSetting("resizeMethod", "display-update");
    const enableAudio = getSetting("enableAudio", true);
    const enableWallpaper = getSetting("enableWallpaper", true);
    const enableTheming = getSetting("enableTheming", true);
    const enableFontSmoothing = getSetting("enableFontSmoothing", true);
    const enableFullWindowDrag = getSetting("enableFullWindowDrag", false);
    const enableDesktopComposition = getSetting("enableDesktopComposition", false);
    const enableMenuAnimations = getSetting("enableMenuAnimations", false);
    const wakeOnLanEnabled = getSetting("wakeOnLanEnabled", false);
    const backspaceMode = getSetting("backspaceMode", "del");
    const deleteMode = getSetting("deleteMode", "vt");
    const functionKeyMode = getSetting("functionKeyMode", "xterm");

    const handleKeyboardLayoutChange = (newLayout) => {
        setConfig(prev => ({ ...prev, keyboardLayout: newLayout }));
    };

    const handleDisplaySettingChange = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const availableJumpHosts = useMemo(() => {
        if (!servers) return [];

        const sshServers = [];
        const collectSSHServers = (entries) => {
            entries.forEach(entry => {
                if (entry.type === 'folder' || entry.type === 'organization') {
                    collectSSHServers(entry.entries || []);
                } else if (entry.type === 'server' && entry.protocol === 'ssh' && entry.id !== editServerId) {
                    sshServers.push(entry);
                }
            });
        };

        collectSSHServers(servers);
        return sshServers;
    }, [servers, editServerId]);

    const handleJumpHostsChange = (newJumpHosts) => {
        setConfig(prev => ({ ...prev, jumpHosts: newJumpHosts }));
    };

    const addJumpHost = () => {
        if (availableJumpHosts.length === 0) return;
        const newJumpHosts = [...jumpHosts, availableJumpHosts[0].id];
        handleJumpHostsChange(newJumpHosts);
    };

    const removeJumpHost = (index) => {
        const newJumpHosts = jumpHosts.filter((_, i) => i !== index);
        handleJumpHostsChange(newJumpHosts);
    };

    const updateJumpHost = (index, serverId) => {
        const newJumpHosts = [...jumpHosts];
        newJumpHosts[index] = serverId;
        handleJumpHostsChange(newJumpHosts);
    };

    const getAvailableServersForPosition = (currentIndex) => {
        const selectedIds = jumpHosts.filter((_, i) => i !== currentIndex);
        return availableJumpHosts.filter(server => !selectedIds.includes(server.id));
    };

    const showJumpHosts = config?.protocol === 'ssh';

    if (!fieldConfig.showKeyboardLayout && !fieldConfig.showDisplaySettings && !fieldConfig.showAudioSettings && !fieldConfig.showWakeOnLan && !fieldConfig.showTerminalSettings && !showJumpHosts) {
        return <p className="text-center">{t('servers.dialog.settings.noSettings')}</p>;
    }

    return (
        <>
            {showJumpHosts && (
                <div className="jump-hosts-section">
                    <div className="jump-hosts-header">
                        <div className="jump-hosts-info">
                            <span className="jump-hosts-label">
                                <Icon path={mdiServerNetwork} size={0.8} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                {t('servers.dialog.settings.jumpHosts.title')}
                            </span>
                            <span className="jump-hosts-description">
                                {t('servers.dialog.settings.jumpHosts.description')}
                            </span>
                        </div>
                    </div>

                    {jumpHosts.length > 0 && (
                        <div className="jump-hosts-list">
                            {jumpHosts.map((jumpHostId, index) => {
                                const availableServers = getAvailableServersForPosition(index);
                                const serverOptions = availableServers.map(s => ({
                                    label: `${s.name} (${s.ip})`,
                                    value: s.id
                                }));

                                return (
                                    <div key={index} className="jump-host-item">
                                        <span className="jump-host-number">{index + 1}</span>
                                        <div className="jump-host-select">
                                            <SelectBox 
                                                options={serverOptions}
                                                selected={jumpHostId}
                                                setSelected={(value) => updateJumpHost(index, value)}
                                                searchable={serverOptions.length > 5}
                                            />
                                        </div>
                                        <button 
                                            className="jump-host-remove"
                                            onClick={() => removeJumpHost(index)}
                                            title={t('servers.dialog.settings.jumpHosts.removeTooltip')}
                                        >
                                            <Icon path={mdiClose} size={0.8} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {availableJumpHosts.length > jumpHosts.length && (
                        <button className="add-jump-host-btn" onClick={addJumpHost}>
                            <Icon path={mdiPlus} size={0.8} />
                            {t('servers.dialog.settings.jumpHosts.addButton')}
                        </button>
                    )}

                    {availableJumpHosts.length === 0 && (
                        <p className="no-jump-hosts-message">
                            {t('servers.dialog.settings.jumpHosts.noServersAvailable')}
                        </p>
                    )}
                </div>
            )}

            {fieldConfig.showWakeOnLan && (
                <div className="settings-toggle">
                    <div className="settings-toggle-info">
                        <label className="settings-toggle-label" htmlFor="wake-on-lan-toggle">
                            <Icon path={mdiPowerPlug} size={0.8} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            {t('servers.dialog.settings.wakeOnLan.title')}
                        </label>
                        <span className="settings-toggle-description">
                            {t('servers.dialog.settings.wakeOnLan.description')}
                        </span>
                    </div>
                    <ToggleSwitch checked={wakeOnLanEnabled} onChange={(val) => handleDisplaySettingChange('wakeOnLanEnabled', val)} id="wake-on-lan-toggle" />
                </div>
            )}

            {fieldConfig.showTerminalSettings && (
                <div className="jump-hosts-section">
                    <div className="jump-hosts-header">
                        <div className="jump-hosts-info">
                            <span className="jump-hosts-label">
                                <Icon path={mdiKeyboardOutline} size={0.8} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                {t('servers.dialog.settings.terminal.title')}
                            </span>
                            <span className="jump-hosts-description">
                                {t('servers.dialog.settings.terminal.description')}
                            </span>
                        </div>
                    </div>

                    <div className="terminal-settings-grid">
                        <div className="form-group">
                            <label htmlFor="server-backspace">{t('servers.dialog.settings.terminal.backspace')}</label>
                            <SelectBox id="server-backspace"
                                options={BACKSPACE_MODES} 
                                selected={backspaceMode} 
                                setSelected={(val) => handleDisplaySettingChange('backspaceMode', val)} 
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="server-delete">{t('servers.dialog.settings.terminal.delete')}</label>
                            <SelectBox id="server-delete"
                                options={DELETE_MODES} 
                                selected={deleteMode} 
                                setSelected={(val) => handleDisplaySettingChange('deleteMode', val)} 
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="server-function-keys">{t('servers.dialog.settings.terminal.functionKeys')}</label>
                            <SelectBox id="server-function-keys"
                                options={FUNCTION_KEY_MODES} 
                                selected={functionKeyMode} 
                                setSelected={(val) => handleDisplaySettingChange('functionKeyMode', val)} 
                            />
                        </div>
                    </div>
                </div>
            )}

            {fieldConfig.showKeyboardLayout && (
                <div className="keyboard-layout-card">
                    <div className="form-group">
                        <label htmlFor="server-keyboard-layout">{t('servers.dialog.settings.keyboardLayout.title')}</label>
                        <SelectBox id="server-keyboard-layout" options={keyboardLayoutOptions} selected={keyboardLayout} setSelected={handleKeyboardLayoutChange} />
                        <p className="keyboard-layout-description">{t('servers.dialog.settings.keyboardLayout.description')}</p>
                    </div>
                </div>
            )}

            {fieldConfig.showCertificatePin && (
                <div className="keyboard-layout-card">
                    <div className="form-group">
                        <label htmlFor="server-cert-fingerprints">{t('servers.dialog.settings.certificate.title')}</label>
                        <IconInput id="server-cert-fingerprints" icon={mdiCertificateOutline} value={config?.certFingerprints || ""}
                            setValue={(value) => handleDisplaySettingChange('certFingerprints', value)}
                            placeholder={t('servers.dialog.settings.certificate.placeholder')} />
                        <p className="keyboard-layout-description">{t('servers.dialog.settings.certificate.description')}</p>
                    </div>
                </div>
            )}

            {fieldConfig.showDisplaySettings && (
                <div className="jump-hosts-section">
                    <div className="jump-hosts-header">
                        <div className="jump-hosts-info">
                            <span className="jump-hosts-label">
                                <Icon path={mdiMonitor} size={0.8} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                {t('servers.dialog.settings.display.title')}
                            </span>
                            <span className="jump-hosts-description">
                                {t('servers.dialog.settings.display.description')}
                            </span>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="server-color-depth">{t('servers.dialog.settings.display.colorDepth')}</label>
                        <SelectBox id="server-color-depth"
                            options={colorDepthOptions}
                            selected={colorDepth} 
                            setSelected={(val) => handleDisplaySettingChange('colorDepth', val)} 
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="server-resize-method">{t('servers.dialog.settings.display.resizeMethod')}</label>
                        <SelectBox id="server-resize-method"
                            options={resizeMethodOptions}
                            selected={resizeMethod} 
                            setSelected={(val) => handleDisplaySettingChange('resizeMethod', val)} 
                        />
                    </div>
                </div>
            )}

            {fieldConfig.showAudioSettings && (
                <div className="settings-toggle">
                    <div className="settings-toggle-info">
                        <label className="settings-toggle-label" htmlFor="enable-audio">
                            <Icon path={mdiVolumeHigh} size={0.8} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            {t('servers.dialog.settings.audio.enableAudio')}
                        </label>
                        <span className="settings-toggle-description">{t('servers.dialog.settings.audio.enableAudioDesc')}</span>
                    </div>
                    <ToggleSwitch checked={enableAudio} onChange={(val) => handleDisplaySettingChange('enableAudio', val)} id="enable-audio" />
                </div>
            )}

            {fieldConfig.showPerformanceSettings && (
                <div className="jump-hosts-section">
                    <div className="jump-hosts-header">
                        <div className="jump-hosts-info">
                            <span className="jump-hosts-label">
                                <Icon path={mdiPalette} size={0.8} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                {t('servers.dialog.settings.performance.title')}
                            </span>
                            <span className="jump-hosts-description">
                                {t('servers.dialog.settings.performance.description')}
                            </span>
                        </div>
                    </div>

                    <div className="settings-toggle">
                        <div className="settings-toggle-info">
                            <label className="settings-toggle-label" htmlFor="enable-wallpaper">{t('servers.dialog.settings.performance.enableWallpaper')}</label>
                            <span className="settings-toggle-description">{t('servers.dialog.settings.performance.enableWallpaperDesc')}</span>
                        </div>
                        <ToggleSwitch checked={enableWallpaper} onChange={(val) => handleDisplaySettingChange('enableWallpaper', val)} id="enable-wallpaper" />
                    </div>

                    <div className="settings-toggle">
                        <div className="settings-toggle-info">
                            <label className="settings-toggle-label" htmlFor="enable-theming">{t('servers.dialog.settings.performance.enableTheming')}</label>
                            <span className="settings-toggle-description">{t('servers.dialog.settings.performance.enableThemingDesc')}</span>
                        </div>
                        <ToggleSwitch checked={enableTheming} onChange={(val) => handleDisplaySettingChange('enableTheming', val)} id="enable-theming" />
                    </div>

                    <div className="settings-toggle">
                        <div className="settings-toggle-info">
                            <label className="settings-toggle-label" htmlFor="enable-font-smoothing">{t('servers.dialog.settings.performance.enableFontSmoothing')}</label>
                            <span className="settings-toggle-description">{t('servers.dialog.settings.performance.enableFontSmoothingDesc')}</span>
                        </div>
                        <ToggleSwitch checked={enableFontSmoothing} onChange={(val) => handleDisplaySettingChange('enableFontSmoothing', val)} id="enable-font-smoothing" />
                    </div>

                    <div className="settings-toggle">
                        <div className="settings-toggle-info">
                            <label className="settings-toggle-label" htmlFor="enable-full-window-drag">{t('servers.dialog.settings.performance.enableFullWindowDrag')}</label>
                            <span className="settings-toggle-description">{t('servers.dialog.settings.performance.enableFullWindowDragDesc')}</span>
                        </div>
                        <ToggleSwitch checked={enableFullWindowDrag} onChange={(val) => handleDisplaySettingChange('enableFullWindowDrag', val)} id="enable-full-window-drag" />
                    </div>

                    <div className="settings-toggle">
                        <div className="settings-toggle-info">
                            <label className="settings-toggle-label" htmlFor="enable-desktop-composition">{t('servers.dialog.settings.performance.enableDesktopComposition')}</label>
                            <span className="settings-toggle-description">{t('servers.dialog.settings.performance.enableDesktopCompositionDesc')}</span>
                        </div>
                        <ToggleSwitch checked={enableDesktopComposition} onChange={(val) => handleDisplaySettingChange('enableDesktopComposition', val)} id="enable-desktop-composition" />
                    </div>

                    <div className="settings-toggle">
                        <div className="settings-toggle-info">
                            <label className="settings-toggle-label" htmlFor="enable-menu-animations">{t('servers.dialog.settings.performance.enableMenuAnimations')}</label>
                            <span className="settings-toggle-description">{t('servers.dialog.settings.performance.enableMenuAnimationsDesc')}</span>
                        </div>
                        <ToggleSwitch checked={enableMenuAnimations} onChange={(val) => handleDisplaySettingChange('enableMenuAnimations', val)} id="enable-menu-animations" />
                    </div>
                </div>
            )}
        </>
    );
};

export default SettingsPage;