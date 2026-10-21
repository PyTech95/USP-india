# Content release 3-way merge preservation (pure functions, no DB / no production identity touched)
import copy
import sys

sys.path.insert(0, "/app/backend")
from content_sync.merge import merge_bundle  # noqa: E402

AMB = "1017b7e20a8648a0b3f8c546ed6f89d6"


def page(label, item_styles, amb_section, heading="The Ambition", body_font="18px", head_font="28px"):
    return {
        "key": "TEST_home", "path": "/TEST_home",
        "published": {"sections": [
            {"id": "rw1", "type": "related_work",
             "data": {"items": [{"title": "Rakhigarhi", "href": "/our-work/rakhigarhi", "link_label": label}]},
             "styles": {"items.0.link_label": item_styles}},
            {"id": AMB, "type": "text", "data": {"layout": "rakhigarhi-ambition-aligned", "heading": heading},
             "styles": {"_section": amb_section, "body_html": {"fontSize": body_font},
                        "heading": {"fontSize": head_font}}},
        ]},
    }


def bundle(pages, site=None):
    return {"collections": {"pages": pages, "notes": [], "media": [], "redirects": []},
            "site": site or {"site_name": "USP"}}


OLD_GEOM = {"width": "1313px", "translateX": "50px", "height": "720px", "translateY": "-96px", "background": "#f0eeec"}
FIXED_GEOM = {"background": "#f0eeec"}
LIVE_STYLE = {"fontSize": "22px", "translateX": "85px", "translateY": "-42px", "width": "143px"}


def _sec(out, sid):
    return next(s for s in out["collections"]["pages"][0]["published"]["sections"] if s["id"] == sid)


class TestMergePreservation:
    def test_incoming_restored_label_keeps_live_font_and_position(self):
        base = bundle([page("", {}, OLD_GEOM)])
        live = bundle([page("", LIVE_STYLE, FIXED_GEOM)])
        incoming = bundle([page("Explore Rakhigarhi", {}, OLD_GEOM)])
        out, preserved = merge_bundle(base, live, incoming)
        rw = _sec(out, "rw1")
        assert rw["data"]["items"][0]["link_label"] == "Explore Rakhigarhi"
        assert rw["styles"]["items.0.link_label"] == LIVE_STYLE

    def test_section_geometry_correction_not_replaced(self):
        base = bundle([page("x", {}, OLD_GEOM)])
        live = bundle([page("x", {}, FIXED_GEOM)])
        incoming = bundle([page("x", {}, copy.deepcopy(OLD_GEOM))])
        out, _ = merge_bundle(base, live, incoming)
        amb = _sec(out, AMB)
        assert amb["styles"]["_section"] == FIXED_GEOM
        for k in ("width", "height", "translateX", "translateY"):
            assert k not in amb["styles"]["_section"]

    def test_geometry_conflict_live_wins(self):
        base = bundle([page("x", {}, OLD_GEOM)])
        live = bundle([page("x", {}, FIXED_GEOM)])
        inc_geom = dict(OLD_GEOM, height="900px")
        incoming = bundle([page("x", {}, inc_geom)])
        out, preserved = merge_bundle(base, live, incoming)
        sec = _sec(out, AMB)["styles"]["_section"]
        assert "height" not in sec and "width" not in sec
        assert any("_section" in p for p in preserved)

    def test_production_typography_preserved(self):
        base = bundle([page("x", {}, FIXED_GEOM, body_font="18px", head_font="18px")])
        live = bundle([page("x", {}, FIXED_GEOM, body_font="18px", head_font="28px")])
        incoming = bundle([page("x", {}, FIXED_GEOM, body_font="18px", head_font="18px")])
        out, _ = merge_bundle(base, live, incoming)
        st = _sec(out, AMB)["styles"]
        assert st["heading"]["fontSize"] == "28px" and st["body_html"]["fontSize"] == "18px"

    def test_ordinary_conflicting_live_edit_has_priority(self):
        base = bundle([page("x", {}, FIXED_GEOM, heading="Base")])
        live = bundle([page("x", {}, FIXED_GEOM, heading="Live edit")])
        incoming = bundle([page("x", {}, FIXED_GEOM, heading="Incoming")])
        out, preserved = merge_bundle(base, live, incoming)
        assert _sec(out, AMB)["data"]["heading"] == "Live edit"
        assert any(p.endswith(".heading") for p in preserved)

    def test_non_conflicting_incoming_change_applied(self):
        base = bundle([page("x", {}, FIXED_GEOM, heading="Base")])
        live = bundle([page("x", {}, FIXED_GEOM, heading="Base")])
        incoming = bundle([page("x", {}, FIXED_GEOM, heading="New")])
        out, preserved = merge_bundle(base, live, incoming)
        assert _sec(out, AMB)["data"]["heading"] == "New"
        assert preserved == []

    def test_inputs_not_mutated(self):
        base = bundle([page("", {}, OLD_GEOM)])
        live = bundle([page("", LIVE_STYLE, FIXED_GEOM)])
        incoming = bundle([page("Explore Rakhigarhi", {}, OLD_GEOM)])
        snap = copy.deepcopy((base, live, incoming))
        merge_bundle(base, live, incoming)
        assert (base, live, incoming) == snap
