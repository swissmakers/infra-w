import "./styles.sass";
import TerminalImage from "@screenshots/terminal-dark.png";
import FileManagerImage from "@screenshots/file-manager-dark.png";
import AuditImage from "@screenshots/audit-replay-dark.png";

export const Features = () => {
    return (
        <section className="features-section">
            <div className="section-header">
                <span className="section-label">How it works</span>
                <h2>Everything you need to operate your servers</h2>
                <p>Connect, manage files and review every session from a single workspace.</p>
            </div>

            <div className="feature-blocks">
                <div className="feature-block">
                    <div className="feature-content">
                        <span className="feature-number">01</span>
                        <h3>Remote Connections</h3>
                        <p>
                            Connect to your servers over SSH, RDP or VNC in tabs. Sessions keep running while you
                            switch pages and can be opened in a separate window or shared with a colleague.
                        </p>
                        <ul className="feature-list">
                            <li>SSH terminal with themes, fonts and snippets</li>
                            <li>RDP & VNC for graphical access</li>
                            <li>Search hosts by name, IP, protocol, OS or tag</li>
                        </ul>
                    </div>
                    <div className="feature-image">
                        <img src={TerminalImage} alt="SSH session to edge-zrh-01 in the INFRA-W workspace"/>
                    </div>
                </div>

                <div className="feature-block feature-reverse">
                    <div className="feature-content">
                        <span className="feature-number">02</span>
                        <h3>File Management</h3>
                        <p>
                            Browse, upload, download and edit files over SFTP. Previews open in movable windows,
                            so two diagrams, images or PDFs can be compared side by side.
                        </p>
                        <ul className="feature-list">
                            <li>Drag and drop uploads</li>
                            <li>Code editor with syntax highlighting</li>
                            <li>Address bar that suggests folders as you type</li>
                        </ul>
                    </div>
                    <div className="feature-image">
                        <img src={FileManagerImage} alt="File manager with two previews side by side"/>
                    </div>
                </div>

                <div className="feature-block">
                    <div className="feature-content">
                        <span className="feature-number">03</span>
                        <h3>Recordings & Audit</h3>
                        <p>
                            Every connection and change is written to the audit log. Organizations can record
                            sessions and ask for a connection reason; recordings replay right in the browser.
                        </p>
                        <ul className="feature-list">
                            <li>Filterable audit log</li>
                            <li>Terminal and desktop session replay</li>
                            <li>Connection reasons and retention per organization</li>
                        </ul>
                    </div>
                    <div className="feature-image">
                        <img src={AuditImage} alt="Replay of a recorded SSH session in the audit log"/>
                    </div>
                </div>
            </div>
        </section>
    )
}