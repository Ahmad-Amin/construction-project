// Starting points for a new project's stages. Pakistani residential builds first. Your spec asks
// for 4 to 8 stages, so a contractor never has to type a list from nothing. Everything stays
// editable on the form.
export type MilestoneTemplate = {
  id: string;
  name: string;
  description: string;
  milestones: string[];
};

export const MILESTONE_TEMPLATES: MilestoneTemplate[] = [
  {
    id: "new-house",
    name: "New house",
    description: "From foundation to final paint",
    milestones: [
      "Foundation",
      "Grey Structure",
      "Electrical",
      "Plumbing",
      "Plaster",
      "Tiling & Flooring",
      "Woodwork",
      "Paint & Finishing",
    ],
  },
  {
    id: "extra-floor",
    name: "Extra floor or extension",
    description: "Building up or out on an existing house",
    milestones: [
      "Columns & Slab",
      "Brickwork",
      "Electrical",
      "Plumbing",
      "Plaster",
      "Flooring & Tiling",
      "Paint & Finishing",
    ],
  },
  {
    id: "renovation",
    name: "Renovation",
    description: "Refresh or rework an existing space",
    milestones: [
      "Demolition & Prep",
      "Repairs",
      "Electrical",
      "Plumbing",
      "Tiling & Flooring",
      "Paint & Finishing",
    ],
  },
  {
    id: "fit-out",
    name: "Shop or office fit-out",
    description: "Interiors for a commercial space",
    milestones: [
      "Layout & Marking",
      "Partitions & Ceiling",
      "Electrical",
      "Flooring",
      "Fixtures & Furniture",
      "Paint & Handover",
    ],
  },
  {
    id: "blank",
    name: "Start from scratch",
    description: "Add your own stages",
    milestones: [],
  },
];

export const DEFAULT_TEMPLATE_ID = "new-house";
