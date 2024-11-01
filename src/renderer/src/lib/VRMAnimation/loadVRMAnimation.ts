import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { VRMAnimation } from './VRMAnimation'
import { VRMAnimationLoaderPlugin } from './VRMAnimationLoaderPlugin'

const loader = new GLTFLoader()
loader.register((parser) => new VRMAnimationLoaderPlugin(parser))

export async function loadVRMAnimation(binaryData: ArrayBuffer): Promise<VRMAnimation | null> {
  const blob = new Blob([binaryData], { type: 'application/octet-stream' })
  const tempUrl = URL.createObjectURL(blob)
  const gltf = await loader.loadAsync(tempUrl)

  const vrmAnimations: VRMAnimation[] = gltf.userData.vrmAnimations
  const vrmAnimation: VRMAnimation | undefined = vrmAnimations[0]

  return vrmAnimation ?? null
}
