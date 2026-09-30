import "./styles.sass";
import { faDocker } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faCopy, faChevronRight, faChevronLeft, faRefresh, faLayerGroup, faTerminal, faHardDrive, faFolderOpen } from "@fortawesome/free-solid-svg-icons";
import { useState } from "react";
import { documentationPage } from "@/common/links.js";

const IMAGE = "swissmakers/infra-w:latest";

const generateEncryptionKey = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

export const Install = () => {
    const [step, setStep] = useState(1);
    const [encryptionKey, setEncryptionKey] = useState(generateEncryptionKey);
    const [deployMethod, setDeployMethod] = useState('run');
    const [runtime, setRuntime] = useState("podman");
    const [volumeType, setVolumeType] = useState('named');
    const [volumeName, setVolumeName] = useState('infra-w');
    const [bindPath, setBindPath] = useState('/opt/infra-w');
    const [copied, setCopied] = useState(false);

    const regenerateKey = () => {
        setEncryptionKey(generateEncryptionKey());
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getRunCommand = () => {
        const volumeArg = volumeType === 'named' 
            ? `-v ${volumeName}:/app/data`
            : `-v ${bindPath}:/app/data${runtime === "podman" ? ":Z" : ""}`;

        return `${runtime} run -d \\
  --name infra-w-local \\
  --network host \\
  --restart always \\
  -e ENCRYPTION_KEY=${encryptionKey} \\
  ${volumeArg} \\
  ${IMAGE}`;
    };

    const getComposeContent = () => {
        const volumeConfig = volumeType === 'named'
            ? `      - ${volumeName}:/app/data`
            : `      - ${bindPath}:/app/data`;

        const volumesSection = volumeType === 'named'
            ? `\nvolumes:\n  ${volumeName}:`
            : '';

        return `services:
  infra-w:
    image: ${IMAGE}
    container_name: infra-w-local
    network_mode: host
    restart: always
    environment:
      - ENCRYPTION_KEY=${encryptionKey}
    volumes:
${volumeConfig}${volumesSection}`;
    };

    const openDocs = (page) => window.open(documentationPage(page), "_blank");

    return (
        <div className="install-page">
            <div className="install-container">
                <div className="install-header">
                    <h1>Install INFRA-W</h1>
                    <p>Configure your deployment in a few simple steps</p>
                </div>

                <div className="wizard-progress">
                    <div className={`progress-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
                        <span className="step-dot">1</span>
                        <span className="step-label">Method</span>
                    </div>
                    <div className="progress-line"/>
                    <div className={`progress-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
                        <span className="step-dot">2</span>
                        <span className="step-label">Storage</span>
                    </div>
                    <div className="progress-line"/>
                    <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>
                        <span className="step-dot">3</span>
                        <span className="step-label">Deploy</span>
                    </div>
                </div>

                <div className="wizard-content">
                    {step === 1 && (
                        <div className="wizard-step">
                            <h2>Deployment Method</h2>
                            <p>Choose deployment format and runtime.</p>

                            <div className="option-cards">
                                <button 
                                    className={`option-card ${deployMethod === 'run' ? 'selected' : ''}`}
                                    onClick={() => setDeployMethod('run')}
                                >
                                    <FontAwesomeIcon icon={faTerminal}/>
                                    <span className="option-title">Run Command</span>
                                    <span className="option-desc">Single command deployment</span>
                                </button>
                                <button 
                                    className={`option-card ${deployMethod === 'compose' ? 'selected' : ''}`}
                                    onClick={() => setDeployMethod('compose')}
                                >
                                    <FontAwesomeIcon icon={faLayerGroup}/>
                                    <span className="option-title">Docker Compose</span>
                                    <span className="option-desc">YAML configuration file</span>
                                </button>
                            </div>

                            <div className="option-cards">
                                <button
                                    className={`option-card ${runtime === 'podman' ? 'selected' : ''}`}
                                    onClick={() => setRuntime('podman')}
                                >
                                    <FontAwesomeIcon icon={faDocker}/>
                                    <span className="option-title">Podman</span>
                                    <span className="option-desc">Recommended runtime</span>
                                </button>
                                <button
                                    className={`option-card ${runtime === 'docker' ? 'selected' : ''}`}
                                    onClick={() => setRuntime('docker')}
                                >
                                    <FontAwesomeIcon icon={faDocker}/>
                                    <span className="option-title">Docker</span>
                                    <span className="option-desc">Compatible runtime</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="wizard-step">
                            <h2>Storage Configuration</h2>
                            <p>Choose how to persist your INFRA-W data.</p>

                            <div className="option-cards">
                                <button 
                                    className={`option-card ${volumeType === 'named' ? 'selected' : ''}`}
                                    onClick={() => setVolumeType('named')}
                                >
                                    <FontAwesomeIcon icon={faHardDrive}/>
                                    <span className="option-title">Named Volume</span>
                                    <span className="option-desc">Docker-managed storage</span>
                                </button>
                                <button 
                                    className={`option-card ${volumeType === 'bind' ? 'selected' : ''}`}
                                    onClick={() => setVolumeType('bind')}
                                >
                                    <FontAwesomeIcon icon={faFolderOpen}/>
                                    <span className="option-title">Bind Mount</span>
                                    <span className="option-desc">Map to host directory</span>
                                </button>
                            </div>

                            <div className="input-group">
                                <label>{volumeType === 'named' ? 'Volume Name' : 'Host Path'}</label>
                                <input 
                                    type="text" 
                                    value={volumeType === 'named' ? volumeName : bindPath}
                                    onChange={(e) => volumeType === 'named' 
                                        ? setVolumeName(e.target.value) 
                                        : setBindPath(e.target.value)
                                    }
                                    placeholder={volumeType === 'named' ? 'infra-w' : '/opt/infra-w'}
                                />
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="wizard-step">
                            <h2>Deploy INFRA-W</h2>
                            <p>
                                {deployMethod === 'run'
                                    ? `Run this command with ${runtime}:`
                                    : 'Save this as docker-compose.yml and run docker compose up -d:'}
                            </p>

                            <div className="command-block" onClick={() => copyToClipboard(deployMethod === 'run' ? getRunCommand() : getComposeContent())}>
                                <div className="command-header">
                                    <FontAwesomeIcon icon={faDocker}/>
                                    <span>{deployMethod === 'run' ? 'Terminal' : 'docker-compose.yml'}</span>
                                    <button className={`copy-btn ${copied ? 'copied' : ''}`}>
                                        <FontAwesomeIcon icon={copied ? faCheck : faCopy}/>
                                        {copied ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                                <pre><code>{deployMethod === 'run' ? getRunCommand() : getComposeContent()}</code></pre>
                            </div>

                            <div className="key-section">
                                <div className="key-header">
                                    <span>Encryption Key</span>
                                    <button className="regen-btn" onClick={regenerateKey}>
                                        <FontAwesomeIcon icon={faRefresh}/>
                                        Regenerate
                                    </button>
                                </div>
                                <p className="key-hint">Save this key securely - you&apos;ll need it if you migrate your data.</p>
                            </div>

                            <div className="access-info">
                                <span className="access-label">After deployment, access INFRA-W at</span>
                                <div className="access-url">
                                    <code>http://localhost:6989</code>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="wizard-actions">
                    {step > 1 && (
                        <button className="btn-back" onClick={() => setStep(step - 1)}>
                            <FontAwesomeIcon icon={faChevronLeft}/>
                            Back
                        </button>
                    )}
                    {step < 3 && (
                        <button className="btn-next" onClick={() => setStep(step + 1)}>
                            Next
                            <FontAwesomeIcon icon={faChevronRight}/>
                        </button>
                    )}
                </div>

                <div className="help-section">
                    <p>Need more options?</p>
                    <div className="help-links">
                        <a onClick={() => openDocs("installation")}>Installation Guide</a>
                        <a onClick={() => openDocs("reverse-proxy")}>Reverse Proxy</a>
                        <a onClick={() => openDocs("ssl")}>SSL Setup</a>
                    </div>
                </div>
            </div>
        </div>
    );
};
