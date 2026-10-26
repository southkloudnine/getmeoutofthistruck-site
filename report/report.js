// Report form: shows the right fields for the kind of report, validates,
// and sends to Formspree (which emails the support inbox).
//
// The app can pre-fill fields with a link like:
//   /report/?platform=ios&version=1.0%20(4)&from=Seattle%2C%20WA

(function () {

    const form = document.getElementById("reportForm");
    const success = document.getElementById("reportSuccess");
    const submitButton = document.getElementById("submitButton");
    const formError = document.getElementById("formError");
    const details = document.getElementById("details");
    const detailsError = document.getElementById("detailsError");
    const email = document.getElementById("email");
    const emailError = document.getElementById("emailError");
    const spotInput = document.getElementById("spot");
    const spotLabel = document.getElementById("spotLabel");
    const detailsLabel = document.getElementById("detailsLabel");

    const SEND_TIMEOUT_MS = 20000;


    function selected(name) {
        const input = form.querySelector(`input[name="${name}"]:checked`);
        return input ? input.value : "";
    }


    // Show only the fields that fit the kind of report. Hidden fields are
    // disabled so they aren't sent.
    function updateVisibleFields() {

        const kind = selected("kind");
        const platform = selected("platform");

        form.querySelectorAll("[data-show-for]").forEach(field => {
            const show = field.dataset.showFor.split(",").includes(kind);
            setFieldVisible(field, show);
        });

        form.querySelectorAll("[data-show-for-platform]").forEach(field => {
            setFieldVisible(field, field.dataset.showForPlatform === platform);
        });

        if (kind === "Great spot to add") {
            spotLabel.textContent = "Which spot?";
            spotInput.placeholder = "Name or address of the spot";
            detailsLabel.textContent = "Why it's great";
            details.placeholder = "Room for how many rigs? Any rules, hours, or tips?";
        } else {
            spotLabel.textContent = "Which spot or suggestion?";
            spotInput.placeholder = "Name or address it gave you";
            detailsLabel.textContent = "Details";
            details.placeholder = "What happened? The more specific, the faster we can fix it.";
        }
    }


    function setFieldVisible(field, show) {
        field.hidden = !show;
        field.querySelectorAll("input, textarea").forEach(input => {
            input.disabled = !show;
        });
    }


    function prefillFromLink() {

        const params = new URLSearchParams(window.location.search);

        const platform = params.get("platform");
        if (platform === "web") {
            form.querySelector('input[name="platform"][value="Website"]').checked = true;
        }

        if (params.get("version")) {
            document.getElementById("appVersion").value = params.get("version");
        }

        if (params.get("from")) {
            document.getElementById("searchedFrom").value = params.get("from");
        }
    }


    function validate() {

        let ok = true;

        const detailsOk = details.value.trim().length >= 5;
        detailsError.hidden = detailsOk;
        details.classList.toggle("invalid", !detailsOk);
        if (!detailsOk) {
            ok = false;
        }

        const emailOk = email.value.trim() === "" || email.validity.valid;
        emailError.hidden = emailOk;
        email.classList.toggle("invalid", !emailOk);
        if (!emailOk) {
            ok = false;
        }

        if (!ok) {
            const firstBad = form.querySelector(".invalid");
            if (firstBad) {
                firstBad.focus();
            }
        }

        return ok;
    }


    async function send(event) {

        event.preventDefault();

        formError.hidden = true;

        if (!validate()) {
            return;
        }

        const endpoint = form.dataset.endpoint;

        // Not connected to Formspree yet: don't pretend it was sent.
        if (!endpoint || endpoint.includes("FORM_ID")) {
            formError.hidden = false;
            return;
        }

        const data = new FormData(form);

        // One readable line for the "what was wrong" chips.
        const problems = data.getAll("problems");
        data.delete("problems");
        if (problems.length) {
            data.set("problems", problems.join(", "));
        }

        const where = (data.get("searched_from") || "").toString().trim();
        data.set("_subject", `${selected("kind")}${where ? " · " + where : ""}`);

        submitButton.disabled = true;
        submitButton.textContent = "Sending...";

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

        try {

            const response = await fetch(endpoint, {
                method: "POST",
                body: data,
                headers: { "Accept": "application/json" },
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`Form service error ${response.status}`);
            }

            document.getElementById("replyNote").hidden = email.value.trim() === "";
            form.hidden = true;
            success.hidden = false;
            success.scrollIntoView({ behavior: "smooth", block: "start" });

        } catch (error) {

            console.error("Report not sent:", error);
            formError.hidden = false;

        } finally {

            clearTimeout(timer);
            submitButton.disabled = false;
            submitButton.textContent = "Send report";
        }
    }


    function sendAnother() {
        form.reset();
        [details, email].forEach(input => input.classList.remove("invalid"));
        detailsError.hidden = true;
        emailError.hidden = true;
        formError.hidden = true;
        prefillFromLink();
        updateVisibleFields();
        success.hidden = true;
        form.hidden = false;
        form.scrollIntoView({ behavior: "smooth", block: "start" });
    }


    form.addEventListener("change", event => {
        if (event.target.name === "kind" || event.target.name === "platform") {
            updateVisibleFields();
        }
    });

    details.addEventListener("input", () => {
        if (!detailsError.hidden && details.value.trim().length >= 5) {
            detailsError.hidden = true;
            details.classList.remove("invalid");
        }
    });

    form.addEventListener("submit", send);
    document.getElementById("sendAnother").addEventListener("click", sendAnother);

    prefillFromLink();
    updateVisibleFields();

})();
