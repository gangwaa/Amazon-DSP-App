document.querySelectorAll(".view-hierarchy").forEach(function (btn) {
  btn.addEventListener("click", function () {
    var id = this.dataset.id;
    var container = document.querySelector('.hierarchy-container[data-id="' + id + '"]');
    if (!container) {
      return;
    }

    if (container.dataset.loaded === "1") {
      container.style.display = container.style.display === "none" ? "block" : "none";
      return;
    }

    container.innerHTML = "Loading...";
    container.style.display = "block";

    fetch("/api/advertisers/" + encodeURIComponent(id) + "/hierarchy")
      .then(function (r) {
        return r.ok ? r.json() : r.json().then(function (j) {
          throw new Error(j.error || r.statusText);
        });
      })
      .then(function (data) {
        var html = '<h4 style="margin:0.5em 0;">Orders / Campaigns</h4>';
        var campaigns = data.campaigns || [];
        var adGroupsByCampaign = data.adGroupsByCampaign || {};

        if (campaigns.length === 0) {
          html += '<p style="color:#666;">No campaigns found.</p>';
        } else {
          campaigns.forEach(function (c) {
            var cState = c.state || "";
            var cStatus = c.deliveryStatus || "";
            html += '<details style="margin:0.5em 0;padding:0.5em;border-left:3px solid #069;background:#f9f9f9;"><summary><strong>' + (c.name || c.campaignId) + "</strong> (" + c.campaignId + ") - " + cState + (cStatus ? " - " + cStatus : "") + "</summary>";
            var adGroups = adGroupsByCampaign[c.campaignId] || [];

            if (adGroups.length === 0) {
              html += '<p style="margin:0.5em 0 0 1em;color:#666;">No line items.</p>';
            } else {
              html += '<div style="margin:0.5em 0 0 1em;">Line items:<ul style="margin:0.25em 0;">';
              adGroups.forEach(function (ag) {
                html += "<li><strong>" + (ag.name || ag.adGroupId) + "</strong> (" + ag.adGroupId + ") - " + (ag.state || "") + (ag.deliveryStatus ? " - " + ag.deliveryStatus : "") + "</li>";
              });
              html += "</ul></div>";
            }

            html += "</details>";
          });
        }

        container.innerHTML = html;
        container.dataset.loaded = "1";
      })
      .catch(function (err) {
        container.innerHTML = '<p style="color:#c00;">Error: ' + (err.message || "Failed to load") + "</p>";
      });
  });
});
