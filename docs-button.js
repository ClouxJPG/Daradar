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
        button.textContent = "Документация";

        Object.assign(button.style, {
            position: "absolute",
            right: "calc(190px + var(--sar))",
            top: "calc(20px + var(--sat))",
            zIndex: "1001",

            padding: "8px 12px",
            border: "1px solid #303640",
            borderRadius: "8px",

            background: "rgba(10,12,17,.92)",
            color: "#e8edf5",

            fontSize: "12px",
            fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif",
            textDecoration: "none",

            cursor: "pointer",
            pointerEvents: "auto",

            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)"
        });

        button.addEventListener("mouseenter", function () {
            button.style.background = "#171b22";
            button.style.borderColor = "#4a5260";
        });

        button.addEventListener("mouseleave", function () {
            button.style.background = "rgba(10,12,17,.92)";
            button.style.borderColor = "#303640";
        });

        logo.parentElement.appendChild(button);
    }

    createDocsButton();
})();
