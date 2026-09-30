import "./styles.sass";
import Logo from "@/common/assets/logo.svg";
import {faXmark, faBars, faGlobe, faArrowUpRightFromSquare} from "@fortawesome/free-solid-svg-icons";
import {faGithub} from "@fortawesome/free-brands-svg-icons";
import {Link, useLocation} from "react-router-dom";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {useState, useEffect} from "react";
import {DOCUMENTATION_BASE, GITHUB_LINK, WEBSITE_LINK} from "@/common/links.js";

export const Navigation = () => {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // closes the mobile menu on navigation without an effect
    const [shownPath, setShownPath] = useState(location.pathname);
    if (shownPath !== location.pathname) {
        setShownPath(location.pathname);
        setMobileOpen(false);
    }

    const isActive = (path) => location.pathname === path;

    return (
        <>
            <nav className={scrolled ? "nav-scrolled" : ""}>
                <Link className="logo-area" to="/">
                    <img src={Logo} alt=""/>
                    <span>INFRA-W</span>
                </Link>

                <div className="nav-links">
                    <Link to="/" className={isActive("/") ? "active" : ""}>Home</Link>
                    <Link to="/install" className={isActive("/install") ? "active" : ""}>Install</Link>
                    <Link to="/changelog" className={isActive("/changelog") ? "active" : ""}>Changelog</Link>
                    <a href={DOCUMENTATION_BASE} target="_blank" rel="noopener noreferrer" className="external-link">
                        Docs
                        <FontAwesomeIcon icon={faArrowUpRightFromSquare}/>
                    </a>
                </div>

                <div className="nav-actions">
                    <a href={WEBSITE_LINK} target="_blank" rel="noopener noreferrer" className="website-link" aria-label="Swissmakers GmbH">
                        <FontAwesomeIcon icon={faGlobe}/>
                    </a>
                    <a href={GITHUB_LINK} target="_blank" rel="noopener noreferrer" className="github-link">
                        <FontAwesomeIcon icon={faGithub}/>
                        <span>GitHub</span>
                    </a>
                </div>

                <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
                    <FontAwesomeIcon icon={mobileOpen ? faXmark : faBars}/>
                </button>
            </nav>

            <div className={`mobile-nav ${mobileOpen ? "mobile-open" : ""}`}>
                <div className="mobile-content">
                    <Link to="/" className="mobile-logo">
                        <img src={Logo} alt=""/>
                        <span>INFRA-W</span>
                    </Link>

                    <div className="mobile-links">
                        <Link to="/" className={isActive("/") ? "active" : ""}>Home</Link>
                        <Link to="/install" className={isActive("/install") ? "active" : ""}>Install</Link>
                        <Link to="/changelog" className={isActive("/changelog") ? "active" : ""}>Changelog</Link>
                        <a href={DOCUMENTATION_BASE} target="_blank" rel="noopener noreferrer">
                            Docs
                            <FontAwesomeIcon icon={faArrowUpRightFromSquare}/>
                        </a>
                        <a href={WEBSITE_LINK} target="_blank" rel="noopener noreferrer">Website</a>
                        <a href={GITHUB_LINK} target="_blank" rel="noopener noreferrer">GitHub</a>
                    </div>
                </div>
            </div>

            {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)}/>}
        </>
    );
}