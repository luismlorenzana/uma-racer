// Shared Spark Rival colours and readable labels (D178). Gameplay remains in the pure engine.
import type { SparkOrb, Strategy } from '@racer/domain'

export const SPARK_STRATEGY_LABELS: Readonly<Record<Strategy, string>> = {
  front: 'Front Runner',
  pace: 'Pace Chaser',
  late: 'Late Surger',
  end: 'End Closer',
}

export const SPARK_ORB_LABELS: Readonly<Record<SparkOrb, string>> = {
  front: 'Front',
  pace: 'Pace',
  late: 'Late',
  end: 'End',
  spark: 'Spark',
  recovery: 'Recovery',
}

export const SPARK_ORB_GLYPHS: Readonly<Record<SparkOrb, string>> = {
  front: 'F',
  pace: 'P',
  late: 'L',
  end: 'E',
  spark: '',
  recovery: '+',
}

export const SPARK_ORB_COLORS: Readonly<Record<SparkOrb, string>> = {
  front: '#e05d58',
  pace: '#4a86e8',
  late: '#9a68db',
  end: '#3ab28f',
  spark: '#f3b53f',
  recovery: '#58bf70',
}

export const SPARK_ORB_PIXI_COLORS: Readonly<Record<SparkOrb, number>> = {
  front: 0xe05d58,
  pace: 0x4a86e8,
  late: 0x9a68db,
  end: 0x3ab28f,
  spark: 0xf3b53f,
  recovery: 0x58bf70,
}
