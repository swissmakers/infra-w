import {Link} from "react-router-dom";
import "./styles.sass";
import Logo from "@/common/assets/logo.svg";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faGlobe} from "@fortawesome/free-solid-svg-icons";
import {faGithub} from "@fortawesome/free-brands-svg-icons";
import {DOCUMENTATION_BASE, GITHUB_LINK, WEBSITE_LINK, documentationPage} from "@/common/links.js";

export const Footer = () => {
    return (
        <footer className="footer">
            <div className="footer-content">
                <div className="footer-brand">
                    <Link to="/" className="footer-logo">
                        <img src={Logo} alt=""/>
                        <span>INFRA-W</span>
                    </Link>
                    <p>Infrastructure Workspace: SSH, RDP, VNC and files in the browser.</p>
                </div>

                <div className="footer-links">
                    <div className="footer-column">
                        <h4>Product</h4>
                        <Link to="/install">Install</Link>
                        <a href={DOCUMENTATION_BASE} target="_blank" rel="noopener noreferrer">Documentation</a>
                        <a href={documentationPage("screenshots")} target="_blank" rel="noopener noreferrer">Screenshots</a>
                    </div>

                    <div className="footer-column">
                        <h4>Legal</h4>
                        <a href={documentationPage("licensing")} target="_blank" rel="noopener noreferrer">Licensing</a>
                        <a href={`${GITHUB_LINK}/blob/main/NOTICE`} target="_blank" rel="noopener noreferrer">Notice &amp; attribution</a>
                    </div>

                    <div className="footer-column">
                        <h4>Connect</h4>
                        <a href={GITHUB_LINK} target="_blank" rel="noopener noreferrer">
                            <FontAwesomeIcon icon={faGithub}/> GitHub
                        </a>
                        <a href={WEBSITE_LINK} target="_blank" rel="noopener noreferrer">
                            <FontAwesomeIcon icon={faGlobe}/> Swissmakers GmbH
                        </a>
                    </div>
                </div>
            </div>

            <div className="footer-bottom">
                <p>© {new Date().getFullYear()} Swissmakers GmbH. Based on Nexterm by Mathias Wagner.</p>
            </div>
        </footer>
    )
}