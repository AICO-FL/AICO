import * as THREE from 'three'
import { Model } from './model'
import { loadVRMAnimation } from '../../lib/VRMAnimation/loadVRMAnimation'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import Stats from 'three/examples/jsm/libs/stats.module'

/**
 * three.jsを使った3Dビューワー
 *
 * setup()でcanvasを渡してから使う
 */
export class Viewer {
  public isReady: boolean
  public model?: Model

  private _renderer?: THREE.WebGLRenderer
  private _clock: THREE.Clock
  private _scene: THREE.Scene
  private _camera?: THREE.PerspectiveCamera
  private _cameraControls?: OrbitControls
  private _stats?: Stats
  private _statsVisible: boolean = false

  constructor() {
    this.isReady = false

    // scene
    const scene = new THREE.Scene()
    this._scene = scene

    // light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8)
    directionalLight.position.set(1.0, 1.0, 1.0).normalize()
    scene.add(directionalLight)

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2)
    scene.add(ambientLight)

    // animate
    this._clock = new THREE.Clock()
    this._clock.start()
  }

  public loadVrm(url) {
    if (this.model?.vrm) {
      this.unloadVRM()
    }

    // gltf and vrm
    this.model = new Model()
    try {
      this.model.loadVRM(url).then(async () => {
        if (!this.model?.vrm) return

        // Disable frustum culling
        this.model.vrm.scene.traverse((obj) => {
          obj.frustumCulled = false
        })

        this._scene.add(this.model.vrm.scene)

        const vrma = await loadVRMAnimation(window.api.getVrmAnimationData())
        if (vrma) this.model.loadAnimation(vrma)

        // HACK: アニメーションの原点がずれているので再生後にカメラ位置を調整する
        requestAnimationFrame(() => {
          this.resetCamera()
        })
      })
    } catch (error) {
      console.error('VRMの読み込み中にエラーが発生しました:', error)
    }
  }

  public unloadVRM(): void {
    if (this.model?.vrm) {
      this._scene.remove(this.model.vrm.scene)
      this.model?.unLoadVrm()
    }
  }

  /**
   * Reactで管理しているCanvasを後から設定する
   */
  public setup(canvas: HTMLCanvasElement) {
    const parentElement = canvas.parentElement
    const width = parentElement?.clientWidth || canvas.width
    const height = parentElement?.clientHeight || canvas.height
    // renderer
    this._renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true
    })
    this._renderer.setSize(width, height)
    this._renderer.setPixelRatio(window.devicePixelRatio)

    // camera
    this._camera = new THREE.PerspectiveCamera(30.0, width / height, 0.1, 20.0)
    this._camera.position.set(0, 1.3, 2.0)
    this._cameraControls?.target.set(0, 1.3, 0)
    this._cameraControls?.update()
    // camera controls
    this._cameraControls = new OrbitControls(this._camera, this._renderer.domElement)
    this._cameraControls.enableZoom = false // ズームを無効にする
    this._cameraControls.enableRotate = false // 回転を無効にする
    this._cameraControls.enablePan = false // パンを無効にする
    this._cameraControls.screenSpacePanning = true
    this._cameraControls.update()

    // Stats の初期化をここで行う
    if (typeof window !== 'undefined') {
      this._stats = new Stats()
      this._stats.dom.style.display = 'none' // 初期状態では非表示
      document.body.appendChild(this._stats.dom)
    }

    window.addEventListener('resize', () => {
      this.resize()
    })
    this.isReady = true
    //this.update()
    this._renderer.setAnimationLoop(this.update)
  }

  /**
   * canvasの親要素を参照してサイズを変更する
   */
  public resize() {
    if (!this._renderer) return

    const parentElement = this._renderer.domElement.parentElement
    if (!parentElement) return

    this._renderer.setPixelRatio(window.devicePixelRatio)
    this._renderer.setSize(parentElement.clientWidth, parentElement.clientHeight)

    if (!this._camera) return
    this._camera.aspect = parentElement.clientWidth / parentElement.clientHeight
    this._camera.updateProjectionMatrix()
  }

  /**
   * VRMのheadノードを参照してカメラ位置を調整する
   */
  public resetCamera() {
    const headNode = this.model?.vrm?.humanoid.getNormalizedBoneNode('head')

    if (headNode) {
      const headWPos = headNode.getWorldPosition(new THREE.Vector3())
      this._camera?.position.set(this._camera.position.x, headWPos.y, this._camera.position.z)
      this._cameraControls?.target.set(headWPos.x, headWPos.y - 0.0, headWPos.z) //位置の上げ下げはここ
      this._cameraControls?.update()
    }
  }

  public setStatsVisibility(visible: boolean) {
    this._statsVisible = visible
    if (this._stats) {
      this._stats.dom.style.display = visible ? 'block' : 'none'
    }
  }

  public update = () => {
    //requestAnimationFrame(this.update)
    const delta = this._clock.getDelta()

    // Stats の更新
    if (this._statsVisible) {
      this._stats?.begin()
    }

    // update vrm components
    if (this.model) {
      this.model.update(delta)
    }

    if (this._renderer && this._camera) {
      this._renderer.render(this._scene, this._camera)
    }

    // Stats の終了
    if (this._statsVisible) {
      this._stats?.end()
    }
  }
}
