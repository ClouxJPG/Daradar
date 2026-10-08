(function () {
    "use strict";

    function createDocsButton() {
        if (document.getElementById("qmDocsButton")) return;

        const logo = document.getElementById("logo");

        if (!logo) {
            setTimeout(createDocsButton, 100);
            return;
        }

        const button = document.createElement("a");

        button.id = "qmDocsButton";
        button.href = "./docs.html";
        button.setAttribute("aria-label", "Документация");
        button.title = "Документация";

        button.innerHTML = `
            <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
            >
                <path
                    d="M6 3.5H14.5L19 8V20.5H6V3.5Z"
                    stroke="#111"
                    stroke-width="1.8"
                    stroke-linejoin="round"
                />
                <path
                    d="M14 3.5V8.5H19"
                    stroke="#111"
                    stroke-width="1.8"
                    stroke-linejoin="round"
                />
                <path
                    d="M9 12H16"
                    stroke="#111"
                    stroke-width="1.8"
                    stroke-linecap="round"
                />
                <path
                    d="M9 15.5H16"
                    stroke="#111"
                    stroke-width="1.8"
                    stroke-linecap="round"
                />
            </svg>
        `;

        Object.assign(button.style, {
            position: "absolute",
            right: "calc(190px + var(--sar))",
            top: "calc(18px + var(--sat))",

            width: "36px",
            height: "36px",

            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            padding: "0",

            background: "#fff",
            color: "#111",

            border: "none",
            borderRadius: "10px",

            boxShadow: "0 2px 10px rgba(0,0,0,.28)",

            textDecoration: "none",
            cursor: "pointer",
            pointerEvents: "auto",

            zIndex: "1001",

            transition: "transform .12s ease, box-shadow .12s ease"
        });

        button.addEventListener("mouseenter", function () {
            button.style.transform = "scale(1.06)";
            button.style.boxShadow = "0 3px 14px rgba(0,0,0,.38)";
        });

        button.addEventListener("mouseleave", function () {
            button.style.transform = "scale(1)";
            button.style.boxShadow = "0 2px 10px rgba(0,0,0,.28)";
        });

        button.addEventListener("touchstart", function () {
            button.style.transform = "scale(.94)";
        }, { passive: true });

        button.addEventListener("touchend", function () {
            button.style.transform = "scale(1)";
        }, { passive: true });

        logo.parentElement.appendChild(button);
    }

    createDocsButton();
})();
