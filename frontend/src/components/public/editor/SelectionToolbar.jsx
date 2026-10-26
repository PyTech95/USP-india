import { ArrowUp, ArrowDown, ArrowUpToLine, ArrowDownToLine, Copy, Eye, EyeOff, ImagePlus, LayoutGrid, Plus, Trash2 } from "lucide-react";

export const SelectionToolbar = ({ section, wholeSection, container, locked, onMove, onDuplicate, onHide, onDelete, onAdd, onSelectSection, onAddPhoto, lines, onLine }) => (
  <div className="live-sectools" data-testid="live-section-tools">
    <button type="button" title={wholeSection ? "Move section up" : "Move selected element up 10px"} aria-label={wholeSection ? "Move section up" : "Move selected element up"} onClick={() => onMove(-1)} data-testid="live-sec-up"><ArrowUp size={14} /></button>
    <button type="button" title={wholeSection ? "Move section down" : "Move selected element down 10px"} aria-label={wholeSection ? "Move section down" : "Move selected element down"} onClick={() => onMove(1)} data-testid="live-sec-down"><ArrowDown size={14} /></button>
    {wholeSection && !locked && <>
      <button type="button" title="Duplicate whole section" aria-label="Duplicate whole section" onClick={onDuplicate} data-testid="live-sec-duplicate"><Copy size={14} /></button>
      <button type="button" title={section.hidden ? "Show whole section" : "Hide whole section"} aria-label={section.hidden ? "Show whole section" : "Hide whole section"} onClick={onHide} data-testid="live-sec-hide">{section.hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
    </>}
    {!container && !(wholeSection && locked) && <button type="button" title={wholeSection ? "Delete whole section, including images" : "Delete selected element only"} aria-label={wholeSection ? "Delete whole section" : "Delete selected element only"} onClick={onDelete} data-testid="live-sec-delete"><Trash2 size={14} /></button>}
    {onLine && <>
      <button type="button" className={lines?.above ? "live-on" : ""} title={lines?.above ? "Remove the line above" : "Add a red line above"} aria-label={lines?.above ? "Remove line above" : "Add line above"} onClick={() => onLine("above")} data-testid="live-tb-line-above"><ArrowUpToLine size={14} /></button>
      <button type="button" className={lines?.below ? "live-on" : ""} title={lines?.below ? "Remove the line below" : "Add a red line below"} aria-label={lines?.below ? "Remove line below" : "Add line below"} onClick={() => onLine("below")} data-testid="live-tb-line-below"><ArrowDownToLine size={14} /></button>
    </>}
    {onAddPhoto && <button type="button" title="Add a photo to this section" aria-label="Add a photo to this section" onClick={onAddPhoto} data-testid="live-add-photo"><ImagePlus size={14} /></button>}
    {wholeSection
      ? <button type="button" title="Add section below" aria-label="Add section below" onClick={onAdd} data-testid="live-sec-add-below"><Plus size={14} /></button>
      : <button type="button" title="Select whole section" aria-label="Select whole section" onClick={onSelectSection} data-testid="live-select-section"><LayoutGrid size={14} /></button>}
  </div>
);
