import type { PlanJson, Phase } from '$lib/types/plan.js';

export interface SectionDiff {
	section: string;
	status: 'added' | 'removed' | 'changed' | 'unchanged';
	oldValue?: string;
	newValue?: string;
}

export function diffPlans(oldPlan: PlanJson, newPlan: PlanJson): SectionDiff[] {
	const diffs: SectionDiff[] = [];

	// Overview
	diffs.push(diffField('Overview', oldPlan.overview, newPlan.overview));

	// Current State
	diffs.push(diffField('Current State', oldPlan.currentState, newPlan.currentState));

	// Implementation Approach
	diffs.push(
		diffField(
			'Implementation Approach',
			oldPlan.implementationApproach,
			newPlan.implementationApproach
		)
	);

	// Key Discoveries
	const oldDiscoveries = oldPlan.keyDiscoveries.map((d) => d.text).join('\n');
	const newDiscoveries = newPlan.keyDiscoveries.map((d) => d.text).join('\n');
	diffs.push(diffField('Key Discoveries', oldDiscoveries, newDiscoveries));

	// Scope Exclusions
	const oldExclusions = oldPlan.scopeExclusions.map((e) => `${e.title}: ${e.reason}`).join('\n');
	const newExclusions = newPlan.scopeExclusions.map((e) => `${e.title}: ${e.reason}`).join('\n');
	diffs.push(diffField('Scope Exclusions', oldExclusions, newExclusions));

	// Phases
	const oldPhaseIds = new Set(oldPlan.phases.map((p) => p.id));
	const newPhaseIds = new Set(newPlan.phases.map((p) => p.id));

	for (const phase of newPlan.phases) {
		if (!oldPhaseIds.has(phase.id)) {
			diffs.push({
				section: `Phase ${phase.number}: ${phase.name}`,
				status: 'added',
				newValue: phaseToString(phase)
			});
		} else {
			const oldPhase = oldPlan.phases.find((p) => p.id === phase.id)!;
			const oldStr = phaseToString(oldPhase);
			const newStr = phaseToString(phase);
			diffs.push(diffField(`Phase ${phase.number}: ${phase.name}`, oldStr, newStr));
		}
	}

	for (const phase of oldPlan.phases) {
		if (!newPhaseIds.has(phase.id)) {
			diffs.push({
				section: `Phase ${phase.number}: ${phase.name}`,
				status: 'removed',
				oldValue: phaseToString(phase)
			});
		}
	}

	// Testing Strategy
	const oldTesting = [
		...oldPlan.testingStrategy.unit,
		...oldPlan.testingStrategy.integration,
		...oldPlan.testingStrategy.manual
	].join('\n');
	const newTesting = [
		...newPlan.testingStrategy.unit,
		...newPlan.testingStrategy.integration,
		...newPlan.testingStrategy.manual
	].join('\n');
	diffs.push(diffField('Testing Strategy', oldTesting, newTesting));

	return diffs.filter((d) => d.status !== 'unchanged');
}

function diffField(section: string, oldVal: string, newVal: string): SectionDiff {
	if (!oldVal && newVal) return { section, status: 'added', newValue: newVal };
	if (oldVal && !newVal) return { section, status: 'removed', oldValue: oldVal };
	if (oldVal !== newVal) return { section, status: 'changed', oldValue: oldVal, newValue: newVal };
	return { section, status: 'unchanged' };
}

function phaseToString(phase: Phase): string {
	const parts = [
		phase.overview,
		...phase.changes.map(
			(c) => `${c.componentName} (${c.filePath}): ${c.description}`
		),
		'Automated:',
		...phase.successCriteria.automated.map((c) => `  - ${c.text}${c.command ? ` [${c.command}]` : ''}`),
		'Manual:',
		...phase.successCriteria.manual.map((c) => `  - ${c.text}`)
	];
	return parts.join('\n');
}
