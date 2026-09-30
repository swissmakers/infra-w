import "./styles.sass";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faShieldHalved, faFolderTree, faUsers, faCode, faScroll, faPlug} from "@fortawesome/free-solid-svg-icons";
import {useRef, useEffect} from "react";
import {documentationPage} from "@/common/links.js";

const features = [
    {
        icon: faShieldHalved,
        title: "Secure Access",
        description: "Two-factor authentication, passkeys, OIDC and LDAP sign-in, and encrypted credential storage keep access protected."
    },
    {
        icon: faFolderTree,
        title: "Organized Structure",
        description: "Organize hosts in folders and find them by name, IP address, protocol, operating system or tag."
    },
    {
        icon: faUsers,
        title: "Organizations",
        description: "Share servers, credentials and scripts with your team through organizations; administrators lock accounts and review every sign-in."
    },
    {
        icon: faCode,
        title: "Snippets",
        description: "Save frequently used commands as snippets for quick access across all your servers.",
        link: documentationPage("scripts&snippets"),
        linkText: "Learn more"
    },
    {
        icon: faScroll,
        title: "Automation Scripts",
        description: "Create and run automation scripts to handle repetitive tasks across your infrastructure.",
        link: documentationPage("scripts&snippets"),
        linkText: "Learn more"
    },
    {
        icon: faPlug,
        title: "Integrations",
        description: "Keep the inventory in sync with NetBox and Proxmox instead of maintaining hosts twice.",
        link: documentationPage("integrations"),
        linkText: "Learn more"
    }
];

export const FeatureGrid = () => {
    const gridRef = useRef(null);

    useEffect(() => {
        const grid = gridRef.current;
        if (!grid) return;

        const handleMouseMove = (e) => {
            const cards = grid.querySelectorAll('.feature-card');

            cards.forEach(card => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                card.style.setProperty('--mouse-x', `${x}px`);
                card.style.setProperty('--mouse-y', `${y}px`);
            });
        };

        grid.addEventListener('mousemove', handleMouseMove);
        return () => grid.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <section className="feature-grid-section">
            <div className="section-header">
                <span className="section-label">Features</span>
                <h2>Built for your workflow</h2>
            </div>

            <div className="feature-grid" ref={gridRef}>
                {features.map((feature, index) => (
                    <div key={index} className="feature-card">
                        <div className="feature-card-border"/>
                        <div className="feature-card-glow"/>
                        <div className="feature-card-content">
                            <div className="feature-icon">
                                <FontAwesomeIcon icon={feature.icon}/>
                            </div>
                            <h3>{feature.title}</h3>
                            <p>
                                {feature.description}
                                {feature.link && (
                                    <> <a href={feature.link} target="_blank" rel="noopener noreferrer">{feature.linkText} →</a></>
                                )}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}