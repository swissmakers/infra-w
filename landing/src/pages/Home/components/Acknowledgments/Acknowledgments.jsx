import "./styles.sass";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHeart} from "@fortawesome/free-solid-svg-icons";

export const Acknowledgments = () => {
    return (
        <section className="acknowledgments">
            <div className="acknowledgments-content">
                <div className="acknowledgments-icon">
                    <FontAwesomeIcon icon={faHeart}/>
                </div>

                <h2>Special Thanks</h2>

                <p className="acknowledgments-text">
                    INFRA-W builds on
                    <a href="https://github.com/gnmyt/Nexterm" target="_blank" rel="noopener noreferrer">
                        Nexterm
                    </a>
                    by Mathias Wagner and on the
                    <a href="https://guacamole.apache.org/" target="_blank" rel="noopener noreferrer">
                        Apache Guacamole
                    </a>
                    project, whose clientless remote desktop gateway powers RDP and VNC. Thanks to them and to all
                    <a href="https://github.com/swissmakers/infra-w/graphs/contributors" target="_blank" rel="noopener noreferrer">
                        contributors
                    </a>
                    who help make this project better every day.
                </p>
            </div>
        </section>
    )
}
