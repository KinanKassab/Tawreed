import type { ComponentProps } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export type CategoryIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const categoryIcons: Record<string, CategoryIconName> = {
  'dental-01': 'tooth-outline',
  'dental-02': 'needle',
  'dental-03': 'face-mask-outline',
  'dental-04': 'medical-bag',
  'dental-05': 'tooth',
  'dental-06': 'screwdriver',
  'dental-07': 'shield-check-outline',
  'dental-08': 'stethoscope',
  'dental-09': 'link-variant',
  'dental-10': 'baby-face-outline',
  'dental-11': 'monitor',
  'dental-12': 'clipboard-check-outline',
};
